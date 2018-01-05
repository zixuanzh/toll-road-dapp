pragma solidity ^0.4.13;

import "./interfaces/PausableI.sol";
import "./Owned.sol";

contract Pausable is Owned, PausableI {
	address private owner;
	bool private pausedState;

	modifier whenPaused {
		if (pausedState == true) revert();
		_;
	}

	modifier whenNotPaused {
		if (pausedState == false) revert();
		_;
	}

	function Pausable(bool initialPausedState) {
		owner = msg.sender;
		pausedState = initialPausedState;
	}

	function setPaused(bool newPausedState)
		public
		fromOwner
		returns (bool success)
	{
		if (newPausedState != pausedState) {
			pausedState = newPausedState;
			LogPausedSet(msg.sender, newPausedState);
			return true;
		}
		return false;
	}

	function isPaused()
		public
		constant
		returns (bool isIndeed)
		{
			return pausedState;
		}
}