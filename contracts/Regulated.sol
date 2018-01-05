pragma solidity ^0.4.13;

import "./interfaces/RegulatedI.sol";
import "./interfaces/RegulatorI.sol";

contract Regulated is RegulatedI {
	address private regulator;

	modifier onlyRegulator {
		if (msg.sender != regulator) revert();
		_;
	}

	function Regulated (address initialRegulator) {
		if (initialRegulator == 0) revert();
		regulator = initialRegulator;
	}

	function getRegulator()
		constant
		public
		returns (RegulatorI currentRegulator)
	{
		return RegulatorI(regulator);
	}

	function setRegulator(address newRegulator)
		public
		onlyRegulator
		returns (bool success)
	{
		if (newRegulator == 0) revert();
		if (newRegulator == regulator) revert();
		address previousRegulator = regulator;
		regulator = newRegulator;
		LogRegulatorSet(previousRegulator, regulator);
		return true;
	}
}