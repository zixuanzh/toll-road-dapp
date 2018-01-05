pragma solidity ^0.4.13;

import "./interfaces/OwnedI.sol";

contract Owned is OwnedI {
	address private owner;

	modifier fromOwner {
		if (msg.sender != getOwner()) revert();
		_;
	}

	function Owned() {
		owner = msg.sender;
	}

	function getOwner()
		public
		constant
		returns (address currentOwner)
	{
		return owner;
	}

	function setOwner(address newOwner)
		public
		fromOwner
		returns (bool success)
	{
		if (newOwner == address(0)) revert();
		if (getOwner() == newOwner) revert();
		address previousOwner = owner;
		owner = newOwner;
		LogOwnerSet(previousOwner, newOwner);
		return true;
	}
}