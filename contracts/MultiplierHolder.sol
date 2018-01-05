pragma solidity ^0.4.13;

import "./interfaces/MultiplierHolderI.sol";
import "./Owned.sol";

contract MultiplierHolder is Owned, MultiplierHolderI {
	// vehicle types to multipliers
	mapping(uint => uint) private multipliers;

	function MultiplierHolder() {
		
	}

	function setMultiplier(uint vehicleType, uint multiplier)
		public
		fromOwner
		returns (bool success)
	{
		if (vehicleType == 0) revert();
		if (multipliers[vehicleType] == multiplier) revert();
		multipliers[vehicleType] = multiplier;
		LogMultiplierSet(msg.sender, vehicleType, multiplier);
		return true;
	}

	function getMultiplier(uint vehicleType)
		constant
		public
		returns (uint multiplier)
	{
		return multipliers[vehicleType];
	}
}