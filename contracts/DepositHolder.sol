pragma solidity ^0.4.13;

import "./interfaces/DepositHolderI.sol";
import "./Owned.sol";

contract DepositHolder is Owned, DepositHolderI {
	uint private depositInWei;

	function DepositHolder(uint initialDepositInWei) {
		if (initialDepositInWei == 0) revert();
		depositInWei = initialDepositInWei;
	}

	function setDeposit(uint depositWeis)
		public
		fromOwner
		returns (bool success)
	{
		if (depositWeis == 0) revert();
		if (depositWeis == depositInWei) revert();
		LogDepositSet(msg.sender, depositWeis);
		return true;
	}

	function getDeposit()
		constant
		public
		returns (uint weis)
	{
		return depositInWei;
	}
}