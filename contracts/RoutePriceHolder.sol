pragma solidity ^0.4.13;

import "./interfaces/RoutePriceHolderI.sol";
import "./TollBoothHolder.sol";

contract RoutePriceHolder is TollBoothHolder, RoutePriceHolderI {
	mapping (address => mapping(address => uint)) internal routePrices;

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
		if (routePrices[entryBooth][exitBooth] == priceWeis) revert();

		routePrices[entryBooth][exitBooth] = priceWeis;
		LogRoutePriceSet(msg.sender, entryBooth, exitBooth, priceWeis);
		return true;
	}

	function getRoutePrice(address entryBooth, address exitBooth)
		constant
		public
		returns (uint priceWeis)
	{
		return routePrices[entryBooth][exitBooth];
	}

	function RoutePriceHolder() {

	}
}