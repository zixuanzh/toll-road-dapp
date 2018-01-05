pragma solidity ^0.4.13;

import "./interfaces/TollBoothHolderI.sol";
import "./Owned.sol";

contract TollBoothHolder is Owned, TollBoothHolderI {
	mapping(address => bool) private tollBooths;

	function TollBoothHolder() {

	}

	function addTollBooth(address tollBooth)
		public
		returns (bool success)
	{
		if (tollBooths[tollBooth]) revert();
		if (tollBooth == address(0x0)) revert();
		tollBooths[tollBooth] = true;
		LogTollBoothAdded(msg.sender, tollBooth);
		return true;
	}

	function isTollBooth(address tollBooth)
		constant
		public
		returns (bool isIndeed)
	{
		return tollBooths[tollBooth];
	}

	function removeTollBooth(address tollBooth)
		public
		returns (bool success)
	{
		if (tollBooths[tollBooth] == false) revert();
		if (tollBooth == address(0x0)) revert();
		tollBooths[tollBooth] = false;
		LogTollBoothRemoved(msg.sender, tollBooth);
		return true;
	}
}