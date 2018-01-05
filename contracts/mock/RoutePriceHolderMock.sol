pragma solidity ^0.4.13;

import "../Owned.sol";
import "../TollBoothHolder.sol";
import "../RoutePriceHolder.sol";

contract RoutePriceHolderMock is TollBoothHolder, RoutePriceHolder {

    function RoutePriceHolderMock() {
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
		return true;
	}
}