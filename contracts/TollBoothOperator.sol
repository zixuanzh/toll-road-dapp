pragma solidity ^0.4.13;

import "./interfaces/TollBoothOperatorI.sol";
import "./Regulated.sol";
import "./Pausable.sol";
import "./DepositHolder.sol";
import "./TollBoothHolder.sol";
import "./MultiplierHolder.sol";
import "./RoutePriceHolder.sol";
import "./Regulator.sol";


contract TollBoothOperator is Pausable, Regulated, DepositHolder, TollBoothHolder, MultiplierHolder, RoutePriceHolder, TollBoothOperatorI {
	uint private collectedFees;

	struct VehicleEntryStruct {
		address vehicleAddress;
		address entryBoothAddress;
		uint requiredDeposit;
		uint additionalDeposit;
	}

	struct PendingPaymentStruct {
		bytes32 exitSecretHashed;
		uint requiredDeposit;
		uint additionalDeposit;
		address vehicleAddress;
	}

	mapping (bytes32 => VehicleEntryStruct) private vehicleOnRoad;
	mapping (address => mapping(address => PendingPaymentStruct[])) private pendingPayments;
	mapping (address => mapping(address => uint)) private pendingPaymentOffsets;

	function TollBoothOperator (bool initialPausedState, uint initialDepositInWei, address initialRegulatorAddress)
	    Pausable(initialPausedState)
	    Regulated(initialRegulatorAddress)
	    DepositHolder(initialDepositInWei)
	{
		if (initialDepositInWei == 0) revert();
		if (initialRegulatorAddress == address(0)) revert();
	}
    

	function hashSecret(bytes32 secret)
		constant
		public
		returns (bytes32 hashed)
	{
		return keccak256(secret);
	}

	function enterRoad(address entryBooth, bytes32 exitSecretHashed)
		public
		payable
		returns (bool success)
	{
		if (isPaused()) revert();
		if (!isTollBooth(entryBooth)) revert();
		if (msg.value < (getDeposit() * getMultiplier(getRegulator().getVehicleType(msg.sender)))) revert();
		VehicleEntryStruct memory newVehicleEntry;
		newVehicleEntry.vehicleAddress = msg.sender;
		newVehicleEntry.entryBoothAddress = entryBooth;
		newVehicleEntry.requiredDeposit = getDeposit() * getMultiplier(getRegulator().getVehicleType(msg.sender));
		newVehicleEntry.additionalDeposit = msg.value - newVehicleEntry.requiredDeposit;
		vehicleOnRoad[exitSecretHashed] = newVehicleEntry;
		LogRoadEntered(msg.sender, entryBooth, exitSecretHashed, msg.value);
		return true;
	}

	function getVehicleEntry(bytes32 exitSecretHashed)
		constant
		public
		returns (address vehicle, address entryBooth, uint depositedWeis)
	{
		return (vehicleOnRoad[exitSecretHashed].vehicleAddress,
			vehicleOnRoad[exitSecretHashed].entryBoothAddress,
			(vehicleOnRoad[exitSecretHashed].requiredDeposit
				+ vehicleOnRoad[exitSecretHashed].additionalDeposit)
			);
	}

	function reportExitRoad(bytes32 exitSecretClear)
		public
		returns (uint status)
	{
		if (isPaused()) revert();
		if (!isTollBooth(msg.sender)) revert();
		bytes32 exitSecretHashed = hashSecret(exitSecretClear);

		if (vehicleOnRoad[exitSecretHashed].requiredDeposit == 0) revert();
		if (vehicleOnRoad[exitSecretHashed].entryBoothAddress == msg.sender) revert();

		if (getRoutePrice(vehicleOnRoad[exitSecretHashed].entryBoothAddress, msg.sender) == 0) {
			PendingPaymentStruct memory newPendingPayment;
			newPendingPayment.exitSecretHashed = exitSecretHashed;
			newPendingPayment.vehicleAddress = vehicleOnRoad[exitSecretHashed].vehicleAddress;
			newPendingPayment.requiredDeposit = vehicleOnRoad[exitSecretHashed].requiredDeposit;
			newPendingPayment.additionalDeposit = vehicleOnRoad[exitSecretHashed].additionalDeposit;
			pendingPayments[vehicleOnRoad[exitSecretHashed].entryBoothAddress][msg.sender].push(newPendingPayment);
			LogPendingPayment(exitSecretHashed, vehicleOnRoad[exitSecretHashed].entryBoothAddress, msg.sender);
			return 2;
		} else {
			uint multiplier = getMultiplier(getRegulator().getVehicleType(vehicleOnRoad[exitSecretHashed].vehicleAddress));
			uint finalFee = getRoutePrice(vehicleOnRoad[exitSecretHashed].entryBoothAddress, msg.sender) * multiplier;
			uint refund = 0;
			uint actualFee = 0;
			if (finalFee >= vehicleOnRoad[exitSecretHashed].requiredDeposit) {
				actualFee = vehicleOnRoad[exitSecretHashed].requiredDeposit;
				collectedFees += actualFee;
				refund = vehicleOnRoad[exitSecretHashed].additionalDeposit;
				vehicleOnRoad[exitSecretHashed].requiredDeposit = 0;
				vehicleOnRoad[exitSecretHashed].additionalDeposit = 0;
				if (!vehicleOnRoad[exitSecretHashed].vehicleAddress.send(refund)) revert();
				LogRoadExited(msg.sender, hashSecret(exitSecretClear), actualFee, refund);
				return 1;
			} else {
				refund = vehicleOnRoad[exitSecretHashed].requiredDeposit - finalFee + vehicleOnRoad[exitSecretHashed].additionalDeposit;
				actualFee = finalFee;
				collectedFees += actualFee;
				vehicleOnRoad[exitSecretHashed].requiredDeposit = 0;
				vehicleOnRoad[exitSecretHashed].additionalDeposit = 0;
				if (!vehicleOnRoad[exitSecretHashed].vehicleAddress.send(refund)) revert();
				LogRoadExited(msg.sender, hashSecret(exitSecretClear), actualFee, refund);
				return 1;
			}
		}
	}

	function getPendingPaymentCount(address entryBooth, address exitBooth)
		constant
		public
		returns (uint count)
	{
		return (pendingPayments[entryBooth][exitBooth].length - pendingPaymentOffsets[entryBooth][exitBooth]);
	}

	function clearSomePendingPayments(address entryBooth, address exitBooth, uint count)
		public
		returns (bool success)
	{	
		if (isPaused()) revert();
		if (!isTollBooth(entryBooth)) revert();
		if (!isTollBooth(exitBooth)) revert();
		if ((pendingPayments[entryBooth][exitBooth].length - pendingPaymentOffsets[entryBooth][exitBooth]) < count) revert();
		if (count == 0) revert();
		for (uint i = 0; i < count; i++) {
			bytes32 exitSecretHashed = pendingPayments[entryBooth][exitBooth][i + pendingPaymentOffsets[entryBooth][exitBooth]].exitSecretHashed;
			uint requiredDeposit = pendingPayments[entryBooth][exitBooth][i + pendingPaymentOffsets[entryBooth][exitBooth]].requiredDeposit;
			uint additionalDeposit = pendingPayments[entryBooth][exitBooth][i + pendingPaymentOffsets[entryBooth][exitBooth]].additionalDeposit;

			uint finalFee = getRoutePrice(entryBooth, exitBooth) * getMultiplier(getRegulator().getVehicleType(pendingPayments[entryBooth][exitBooth][i + pendingPaymentOffsets[entryBooth][exitBooth]].vehicleAddress));
			uint refund = 0;
			if (finalFee >= requiredDeposit) {
				collectedFees += requiredDeposit;
				refund = additionalDeposit;
				vehicleOnRoad[exitSecretHashed].requiredDeposit = 0;
				vehicleOnRoad[exitSecretHashed].additionalDeposit = 0;
				if (!pendingPayments[entryBooth][exitBooth][i + pendingPaymentOffsets[entryBooth][exitBooth]].vehicleAddress.send(refund)) revert();
				LogRoadExited(exitBooth, exitSecretHashed, requiredDeposit, refund);
			} else {
				refund = requiredDeposit - finalFee + additionalDeposit;
				collectedFees += finalFee;
				vehicleOnRoad[exitSecretHashed].requiredDeposit = 0;
				vehicleOnRoad[exitSecretHashed].additionalDeposit = 0;
				if (!pendingPayments[entryBooth][exitBooth][i + pendingPaymentOffsets[entryBooth][exitBooth]].vehicleAddress.send(refund)) revert();
				LogRoadExited(exitBooth, exitSecretHashed, finalFee, refund);
			}
		}
		pendingPaymentOffsets[entryBooth][exitBooth] += count;
		return true;
	}

	function getCollectedFeesAmount()
		constant
		public
		returns (uint amount)
	{
		return collectedFees;
	}

	function withdrawCollectedFees()
		public
		fromOwner
		returns (bool success)
	{
		if (collectedFees == 0) revert();
		uint amountToSend = collectedFees;
		collectedFees -= amountToSend;
		if (!msg.sender.send(amountToSend)) revert();
		LogFeesCollected(msg.sender, amountToSend);
		return true;
	}

	function setRoutePrice(
		address entryBooth,
		address exitBooth,
		uint priceWeis)
	public
	fromOwner
	returns (bool success) {
		if (!isTollBooth(entryBooth)) revert();
		if (!isTollBooth(exitBooth)) revert();
		if (entryBooth == exitBooth) revert();
		if (exitBooth == address(0x0)) revert();
		if (entryBooth == address(0x0)) revert();
		if (getRoutePrice(entryBooth, exitBooth) == priceWeis) revert();
		routePrices[entryBooth][exitBooth] = priceWeis;
		LogRoutePriceSet(msg.sender, entryBooth, exitBooth, priceWeis);
		if (getPendingPaymentCount(entryBooth, exitBooth) > 0) {
			clearSomePendingPayments(entryBooth, exitBooth, 1);
		}
		return true;
	}
}
