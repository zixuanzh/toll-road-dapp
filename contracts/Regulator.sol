pragma solidity ^0.4.13;

import "./interfaces/RegulatorI.sol";
import "./TollBoothOperator.sol";
import "./Owned.sol";

contract Regulator is Owned, RegulatorI {
	mapping(address => uint) public vehicleAddressToType;
	mapping(address => bool) private operators;

	function Regulator() {

	}

	function setVehicleType(address vehicle, uint vehicleType)
		public
		returns (bool success) 
	{
		if (vehicle == address(0x0)) revert();
		if (vehicleAddressToType[vehicle] == vehicleType) revert();
		vehicleAddressToType[vehicle] = vehicleType;
		LogVehicleTypeSet(msg.sender, vehicle, vehicleType);
		return true;
	}

	function getVehicleType(address vehicle)
		constant
		public
		returns (uint vehicleType)
	{
		return vehicleAddressToType[vehicle];
	}

	function createNewOperator(address owner, uint deposit)
		public
		fromOwner
		returns (TollBoothOperatorI newOperator)
	{
		if (owner == getOwner()) revert();
		TollBoothOperator newTollBoothOperator = new TollBoothOperator(true, deposit, address(this));
		newTollBoothOperator.setOwner(owner);
		operators[newTollBoothOperator] = true;
		LogTollBoothOperatorCreated(msg.sender, newTollBoothOperator, owner, deposit);
		return newTollBoothOperator;
	}

	function removeOperator(address operator)
		public
		fromOwner
		returns (bool success)
	{
		if (!operators[operator]) revert();
		operators[operator] = false;
		LogTollBoothOperatorRemoved(msg.sender, operator);
		return true;
	}

	function isOperator(address operator)
		constant
		public
		returns (bool indeed)
	{
		return (operators[operator]);
	}
}