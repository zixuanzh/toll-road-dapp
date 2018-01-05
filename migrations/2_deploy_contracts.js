var Regulator = artifacts.require("./Regulator.sol");
var TollBoothOperator = artifacts.require("./TollBoothOperator.sol");

var operatorOwner = "0x4fe840580a268f4930db91171e8d53d690473a83";
var deposit = 5000;

module.exports = function(deployer) {
	deployer.deploy(Regulator)
  //  	.then(() => {
		// Regulator.deployed()
		// .then(regulator => regulator.createNewOperator(operatorOwner, deposit))
		// .then(tx => TollBoothOperator.at(tx.logs[1].args.newOperator).setPaused(false, {from: operatorOwner }))
		// .catch(err => console.log(err));        
  //  	});
};