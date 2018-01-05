const expectedExceptionPromise = require("../utils/expectedException.js");
web3.eth.getTransactionReceiptMined = require("../utils/getTransactionReceiptMined.js");
Promise = require("bluebird");
Promise.allNamed = require("../utils/sequentialPromiseNamed.js");
const randomIntIn = require("../utils/randomIntIn.js");
const toBytes32 = require("../utils/toBytes32.js");

if (typeof web3.eth.getAccountsPromise === "undefined") {
    Promise.promisifyAll(web3.eth, { suffix: "Promise" });
}

const Regulator = artifacts.require("./Regulator.sol");
const TollBoothOperator = artifacts.require("./TollBoothOperator.sol");

contract('TollBoothOperator', function(accounts) {
	let owner0, owner1,
        booth1, booth2,
        vehicle1, vehicle2,
        regulator, operator,
        vehicleInitBal1, vehicleInitBal2;
    const price12 = randomIntIn(1, 1000);
    const extraDeposit = randomIntIn(1, 1000);
    const deposit1 = price12 + randomIntIn(1, 1000);
    const deposit2 = deposit1 + randomIntIn(1, 1000);
    const vehicleType1 = randomIntIn(1, 1000);
    const vehicleType2 = vehicleType1 + randomIntIn(1, 1000);
    const multiplier1 = randomIntIn(1, 1000);
    const multiplier2 = multiplier1 + randomIntIn(1, 1000);
    const tmpSecret = randomIntIn(1, 1000);
    const secret1 = toBytes32(tmpSecret);
    const secret2 = toBytes32(tmpSecret + randomIntIn(1, 1000));
    let hashed1, hashed2;

  before("should prepare", function() {
      assert.isAtLeast(accounts.length, 8);
      owner0 = accounts[0];
      owner1 = accounts[1];
      booth1 = accounts[2];
      booth2 = accounts[3];
      vehicle1 = accounts[4];
      vehicle2 = accounts[5];
      return web3.eth.getBalancePromise(owner0)
          .then(balance => assert.isAtLeast(web3.fromWei(balance).toNumber(), 10));
  });

  describe("Vehicle Operations", function() {

  	beforeEach("should deploy regulator and operator", function() {
      return Regulator.new({ from: owner0 })
          .then(instance => regulator = instance)
          .then(() => regulator.setVehicleType(vehicle1, vehicleType1, { from: owner0 }))
          .then(tx => regulator.setVehicleType(vehicle2, vehicleType2, { from: owner0 }))
          .then(tx => regulator.createNewOperator(owner1, deposit1, { from: owner0 }))
          .then(tx => operator = TollBoothOperator.at(tx.logs[1].args.newOperator))
          .then(tx => operator.addTollBooth(booth1, { from: owner1 }))
          .then(tx => operator.addTollBooth(booth2, { from: owner1 }))
          .then(tx => operator.setMultiplier(vehicleType1, multiplier1, { from: owner1 }))
          .then(tx => operator.setMultiplier(vehicleType2, multiplier2, { from: owner1 }))
          .then(tx => operator.setPaused(false, { from: owner1 }))
          .then(tx => operator.hashSecret(secret1))
          .then(hash => hashed1 = hash)
          .then(tx => operator.hashSecret(secret2))
          .then(hash => hashed2 = hash);
  	});

  	describe("test refund", function() {

  		it("Scenario 1: should return no refund when route price equals deposit", function() {
  			return operator.setRoutePrice(booth1, booth2, deposit1, { from: owner1 })
  				.then(tx => operator.enterRoad.call(booth1, hashed1, { from: vehicle1, value: deposit1 * multiplier1 }))
  				.then(success => assert.isTrue(success))
  				.then(() => operator.enterRoad(
  					booth1, hashed1, { from: vehicle1, value: deposit1 * multiplier1 }))
  				.then(tx => {
  					assert.strictEqual(tx.receipt.logs.length, 1);
            assert.strictEqual(tx.logs.length, 1);
            const logEntered = tx.logs[0];
            assert.strictEqual(logEntered.event, "LogRoadEntered");
            assert.strictEqual(logEntered.args.vehicle, vehicle1);
            assert.strictEqual(logEntered.args.entryBooth, booth1);
            assert.strictEqual(logEntered.args.exitSecretHashed, hashed1);
            assert.strictEqual(logEntered.args.depositedWeis.toNumber(), deposit1 * multiplier1);
            return operator.getVehicleEntry(hashed1);
  				})
  				.then(tx => web3.eth.getBalancePromise(vehicle1))
  				.then(balance => vehicleInitBal1 = balance)
  				.then(tx => operator.reportExitRoad.call(secret1, { from: booth2 }))
  				.then(result => assert.strictEqual(result.toNumber(), 1))
          .then(() => operator.reportExitRoad(secret1, { from: booth2 }))
          .then(tx => {
            assert.strictEqual(tx.receipt.logs.length, 1);
            assert.strictEqual(tx.logs.length, 1);
            const logExited = tx.logs[0];
            assert.strictEqual(logExited.event, "LogRoadExited");
            assert.strictEqual(logExited.args.exitBooth, booth2);
            assert.strictEqual(logExited.args.exitSecretHashed, hashed1);
            assert.strictEqual(logExited.args.finalFee.toNumber(), deposit1 * multiplier1);
            assert.strictEqual(logExited.args.refundWeis.toNumber(), 0);
            return Promise.allNamed({
            	operator: () => web3.eth.getBalancePromise(operator.address),
            	collected: () => operator.getCollectedFeesAmount(),
            	vehicle1: () => web3.eth.getBalancePromise(vehicle1)
            });
          })
          .then(balances => {
          	assert.strictEqual(balances.operator.toNumber(), deposit1 * multiplier1);
            assert.strictEqual(balances.collected.toNumber(), deposit1 * multiplier1);
            assert.strictEqual(
              balances.vehicle1.toString(10),
              vehicleInitBal1.toString(10));
          });
  		});

  		it("Scenario 2: should return no refund when route price is greater than deposit", function() {
  			return operator.setRoutePrice(booth1, booth2, deposit1 + extraDeposit, { from: owner1 })
  				.then(tx => operator.enterRoad.call(booth1, hashed1, { from: vehicle1, value: deposit1 * multiplier1 }))
  				.then(success => assert.isTrue(success))
  				.then(() => operator.enterRoad(
  					booth1, hashed1, { from: vehicle1, value: deposit1 * multiplier1 }))
  				.then(tx => {
  					assert.strictEqual(tx.receipt.logs.length, 1);
            assert.strictEqual(tx.logs.length, 1);
            const logEntered = tx.logs[0];
            assert.strictEqual(logEntered.event, "LogRoadEntered");
            assert.strictEqual(logEntered.args.vehicle, vehicle1);
            assert.strictEqual(logEntered.args.entryBooth, booth1);
            assert.strictEqual(logEntered.args.exitSecretHashed, hashed1);
            assert.strictEqual(logEntered.args.depositedWeis.toNumber(), deposit1 * multiplier1);
            return operator.getVehicleEntry(hashed1);
  				})
  				.then(tx => web3.eth.getBalancePromise(vehicle1))
  				.then(balance => vehicleInitBal1 = balance)
  				.then(tx => operator.reportExitRoad.call(secret1, { from: booth2 }))
  				.then(result => assert.strictEqual(result.toNumber(), 1))
          .then(() => operator.reportExitRoad(secret1, { from: booth2 }))
          .then(tx => {
            assert.strictEqual(tx.receipt.logs.length, 1);
            assert.strictEqual(tx.logs.length, 1);
            const logExited = tx.logs[0];
            assert.strictEqual(logExited.event, "LogRoadExited");
            assert.strictEqual(logExited.args.exitBooth, booth2);
            assert.strictEqual(logExited.args.exitSecretHashed, hashed1);
            assert.strictEqual(logExited.args.finalFee.toNumber(), deposit1 * multiplier1);
            assert.strictEqual(logExited.args.refundWeis.toNumber(), 0);
            return Promise.allNamed({
            	operator: () => web3.eth.getBalancePromise(operator.address),
            	collected: () => operator.getCollectedFeesAmount(),
            	vehicle1: () => web3.eth.getBalancePromise(vehicle1)
            });
          })
          .then(balances => {
          	assert.strictEqual(balances.operator.toNumber(), deposit1 * multiplier1);
            assert.strictEqual(balances.collected.toNumber(), deposit1 * multiplier1);
            assert.strictEqual(
              balances.vehicle1.toString(10),
              vehicleInitBal1.toString(10));
          });
  		});

  		it("Scenario 3: should refund the difference when route price is smaller than deposit", function() {
  			return operator.setRoutePrice(booth1, booth2, price12, { from: owner1 })
  				.then(tx => operator.enterRoad.call(booth1, hashed1, { from: vehicle1, value: deposit1 * multiplier1 }))
  				.then(success => assert.isTrue(success))
  				.then(() => operator.enterRoad(
  					booth1, hashed1, { from: vehicle1, value: deposit1 * multiplier1 }))
  				.then(tx => {
  					assert.strictEqual(tx.receipt.logs.length, 1);
            assert.strictEqual(tx.logs.length, 1);
            const logEntered = tx.logs[0];
            assert.strictEqual(logEntered.event, "LogRoadEntered");
            assert.strictEqual(logEntered.args.vehicle, vehicle1);
            assert.strictEqual(logEntered.args.entryBooth, booth1);
            assert.strictEqual(logEntered.args.exitSecretHashed, hashed1);
            assert.strictEqual(logEntered.args.depositedWeis.toNumber(), deposit1 * multiplier1);
            return operator.getVehicleEntry(hashed1);
  				})
  				.then(tx => web3.eth.getBalancePromise(vehicle1))
  				.then(balance => vehicleInitBal1 = balance)
  				.then(tx => operator.reportExitRoad.call(secret1, { from: booth2 }))
  				.then(result => assert.strictEqual(result.toNumber(), 1))
          .then(() => operator.reportExitRoad(secret1, { from: booth2 }))
          .then(tx => {
            assert.strictEqual(tx.receipt.logs.length, 1);
            assert.strictEqual(tx.logs.length, 1);
            const logExited = tx.logs[0];
            assert.strictEqual(logExited.event, "LogRoadExited");
            assert.strictEqual(logExited.args.exitBooth, booth2);
            assert.strictEqual(logExited.args.exitSecretHashed, hashed1);
            assert.strictEqual(logExited.args.finalFee.toNumber(), price12 * multiplier1);
            assert.strictEqual(logExited.args.refundWeis.toNumber(), (deposit1 - price12) * multiplier1);
            return Promise.allNamed({
            	operator: () => web3.eth.getBalancePromise(operator.address),
            	collected: () => operator.getCollectedFeesAmount(),
            	vehicle1: () => web3.eth.getBalancePromise(vehicle1)
            });
          })
          .then(balances => {
          	assert.strictEqual(balances.operator.toNumber(), price12 * multiplier1);
            assert.strictEqual(balances.collected.toNumber(), price12 * multiplier1);
            assert.strictEqual(
              balances.vehicle1.toString(10),
              vehicleInitBal1.plus((deposit1 - price12) * multiplier1).toString(10));
          });
  		});

  		it("Scenario 4: should refund when deposit more than required and price equals to requirement", function() {
  			return operator.setRoutePrice(booth1, booth2, (deposit1 + extraDeposit), { from: owner1 })
  				.then(tx => operator.enterRoad.call(booth1, hashed1, { from: vehicle1, value: (deposit1 + extraDeposit) * multiplier1 }))
  				.then(success => assert.isTrue(success))
  				.then(() => operator.enterRoad(
  					booth1, hashed1, { from: vehicle1, value: (deposit1 + extraDeposit) * multiplier1 }))
  				.then(tx => {
  					assert.strictEqual(tx.receipt.logs.length, 1);
            assert.strictEqual(tx.logs.length, 1);
            const logEntered = tx.logs[0];
            assert.strictEqual(logEntered.event, "LogRoadEntered");
            assert.strictEqual(logEntered.args.vehicle, vehicle1);
            assert.strictEqual(logEntered.args.entryBooth, booth1);
            assert.strictEqual(logEntered.args.exitSecretHashed, hashed1);
            assert.strictEqual(logEntered.args.depositedWeis.toNumber(), (deposit1 + extraDeposit) * multiplier1);
            return operator.getVehicleEntry(hashed1);
  				})
  				.then(tx => web3.eth.getBalancePromise(vehicle1))
  				.then(balance => vehicleInitBal1 = balance)
  				.then(tx => operator.reportExitRoad.call(secret1, { from: booth2 }))
  				.then(result => assert.strictEqual(result.toNumber(), 1))
          .then(() => operator.reportExitRoad(secret1, { from: booth2 }))
          .then(tx => {
            assert.strictEqual(tx.receipt.logs.length, 1);
            assert.strictEqual(tx.logs.length, 1);
            const logExited = tx.logs[0];
            assert.strictEqual(logExited.event, "LogRoadExited");
            assert.strictEqual(logExited.args.exitBooth, booth2);
            assert.strictEqual(logExited.args.exitSecretHashed, hashed1);
            assert.strictEqual(logExited.args.finalFee.toNumber(), deposit1 * multiplier1);
            assert.strictEqual(logExited.args.refundWeis.toNumber(), extraDeposit * multiplier1);
            return Promise.allNamed({
            	operator: () => web3.eth.getBalancePromise(operator.address),
            	collected: () => operator.getCollectedFeesAmount(),
            	vehicle1: () => web3.eth.getBalancePromise(vehicle1)
            });
          })
          .then(balances => {
          	assert.strictEqual(balances.operator.toNumber(), deposit1 * multiplier1);
            assert.strictEqual(balances.collected.toNumber(), deposit1 * multiplier1);
            assert.strictEqual(
              balances.vehicle1.toString(10),
              vehicleInitBal1.plus(extraDeposit * multiplier1).toString(10));
          });
  		});

  		it("Scenario 5: should refund when price is less than deposit upon route price update", function() {
  			return operator.enterRoad.call(booth1, hashed1, { from: vehicle1, value: (deposit1 + extraDeposit) * multiplier1 })
  				.then(success => assert.isTrue(success))
  				.then(() => operator.enterRoad(
  					booth1, hashed1, { from: vehicle1, value: (deposit1 + extraDeposit) * multiplier1 }))
  				.then(tx => web3.eth.getBalancePromise(vehicle1))
  				.then(balance => vehicleInitBal1 = balance)
  				.then(tx => operator.reportExitRoad.call(secret1, { from: booth2 }))
  				.then(result => assert.strictEqual(result.toNumber(), 2))
          .then(() => operator.reportExitRoad(secret1, { from: booth2 }))
          .then(tx => {
            assert.strictEqual(tx.receipt.logs.length, 1);
            assert.strictEqual(tx.logs.length, 1);
            const logPending = tx.logs[0];
            assert.strictEqual(logPending.event, "LogPendingPayment");
            assert.strictEqual(logPending.args.exitSecretHashed, hashed1);
            assert.strictEqual(logPending.args.entryBooth, booth1);
            assert.strictEqual(logPending.args.exitBooth, booth2);
            return Promise.allNamed({
            	hashed1: () => operator.getVehicleEntry(hashed1),
              pendingCount12: () => operator.getPendingPaymentCount(booth1, booth2)
            });
          })
          .then(info => {
            assert.strictEqual(info.hashed1[0], vehicle1);
            assert.strictEqual(info.hashed1[1], booth1);
            assert.strictEqual(info.hashed1[2].toNumber(), (deposit1 + extraDeposit) * multiplier1);
            assert.strictEqual(info.pendingCount12.toNumber(), 1);
          })
          .then(() => operator.setRoutePrice(booth1, booth2, deposit1, { from: owner1 }))
          .then(tx => {
          	assert.strictEqual(tx.receipt.logs.length, 2);
            assert.strictEqual(tx.logs.length, 2);
            const logPriceSet = tx.logs[0];
            const logExited = tx.logs[1];
            assert.strictEqual(logPriceSet.event, "LogRoutePriceSet");
            assert.strictEqual(logPriceSet.args.sender, owner1);
            assert.strictEqual(logPriceSet.args.entryBooth, booth1);
            assert.strictEqual(logPriceSet.args.exitBooth, booth2);
            assert.strictEqual(logPriceSet.args.priceWeis.toNumber(), deposit1);
            assert.strictEqual(logExited.event, "LogRoadExited");
            assert.strictEqual(logExited.args.exitBooth, booth2);
            assert.strictEqual(logExited.args.exitSecretHashed, hashed1);
            assert.strictEqual(logExited.args.finalFee.toNumber(), deposit1 * multiplier1);
            assert.strictEqual(logExited.args.refundWeis.toNumber(), extraDeposit * multiplier1);
            return Promise.allNamed({
            	operator: () => web3.eth.getBalancePromise(operator.address),
            	collected: () => operator.getCollectedFeesAmount(),
            	vehicle1: () => web3.eth.getBalancePromise(vehicle1)
            });
          })
          .then(balances => {
          	assert.strictEqual(balances.operator.toNumber(), deposit1 * multiplier1);
            assert.strictEqual(balances.collected.toNumber(), deposit1 * multiplier1);
            assert.strictEqual(
              balances.vehicle1.toString(10),
              vehicleInitBal1.plus(extraDeposit * multiplier1).toString(10));
          });
  		});

  		it("Scenario 6: should refund both for two deposits greater than required and clear pending", function() {
  			return operator.enterRoad.call(booth1, hashed1, { from: vehicle1, value: (deposit1 + extraDeposit) * multiplier1 })
  				.then(success => assert.isTrue(success))
  				.then(() => operator.enterRoad(
  					booth1, hashed1, { from: vehicle1, value: (deposit1 + extraDeposit) * multiplier1 }))
  				.then(tx => web3.eth.getBalancePromise(vehicle1))
  				.then(balance => vehicleInitBal1 = balance)
  				.then(() => operator.enterRoad.call(booth1, hashed2, { from: vehicle2, value: deposit1 * multiplier2 }))
  				.then(success => assert.isTrue(success))
  				.then(() => operator.enterRoad(
  					booth1, hashed2, { from: vehicle2, value: deposit1 * multiplier2 }))
  				.then(tx => web3.eth.getBalancePromise(vehicle2))
  				.then(balance => vehicleInitBal2 = balance)
  				.then(tx => operator.reportExitRoad.call(secret1, { from: booth2 }))
  				.then(result => assert.strictEqual(result.toNumber(), 2))
          .then(() => operator.reportExitRoad(secret1, { from: booth2 }))
          .then(tx => {
            assert.strictEqual(tx.receipt.logs.length, 1);
            assert.strictEqual(tx.logs.length, 1);
            const logPending = tx.logs[0];
            assert.strictEqual(logPending.event, "LogPendingPayment");
            assert.strictEqual(logPending.args.exitSecretHashed, hashed1);
            assert.strictEqual(logPending.args.entryBooth, booth1);
            assert.strictEqual(logPending.args.exitBooth, booth2); })
          .then(tx => operator.reportExitRoad.call(secret2, { from: booth2 }))
  				.then(result => assert.strictEqual(result.toNumber(), 2))
          .then(() => operator.reportExitRoad(secret2, { from: booth2 }))
          .then(tx => {
            assert.strictEqual(tx.receipt.logs.length, 1);
            assert.strictEqual(tx.logs.length, 1);
            const logPending = tx.logs[0];
            assert.strictEqual(logPending.event, "LogPendingPayment");
            assert.strictEqual(logPending.args.exitSecretHashed, hashed2);
            assert.strictEqual(logPending.args.entryBooth, booth1);
            assert.strictEqual(logPending.args.exitBooth, booth2);
            return Promise.allNamed({
            	hashed1: () => operator.getVehicleEntry(hashed1),
            	hashed2: () => operator.getVehicleEntry(hashed2),
              pendingCount12: () => operator.getPendingPaymentCount(booth1, booth2)
            });
          })
          .then(info => {
            assert.strictEqual(info.hashed1[0], vehicle1);
            assert.strictEqual(info.hashed1[1], booth1);
            assert.strictEqual(info.hashed1[2].toNumber(), (deposit1 + extraDeposit) * multiplier1);
            assert.strictEqual(info.hashed2[0], vehicle2);
            assert.strictEqual(info.hashed2[1], booth1);
            assert.strictEqual(info.hashed2[2].toNumber(), deposit1 * multiplier2);
            assert.strictEqual(info.pendingCount12.toNumber(), 2);
          })
          .then(() => operator.setRoutePrice(booth1, booth2, price12, { from: owner1 }))
          .then(tx => {
          	assert.strictEqual(tx.receipt.logs.length, 2);
            assert.strictEqual(tx.logs.length, 2);
            const logPriceSet = tx.logs[0];
            const logExited = tx.logs[1];
            assert.strictEqual(logPriceSet.event, "LogRoutePriceSet");
            assert.strictEqual(logPriceSet.args.sender, owner1);
            assert.strictEqual(logPriceSet.args.entryBooth, booth1);
            assert.strictEqual(logPriceSet.args.exitBooth, booth2);
            assert.strictEqual(logPriceSet.args.priceWeis.toNumber(), price12);
            assert.strictEqual(logExited.event, "LogRoadExited");
            assert.strictEqual(logExited.args.exitBooth, booth2);
            assert.strictEqual(logExited.args.exitSecretHashed, hashed1);
            assert.strictEqual(logExited.args.finalFee.toNumber(), price12 * multiplier1);
            assert.strictEqual(logExited.args.refundWeis.toNumber(), (deposit1 + extraDeposit - price12) * multiplier1);
            return Promise.allNamed({
            	operator: () => web3.eth.getBalancePromise(operator.address),
            	collected: () => operator.getCollectedFeesAmount(),
            	vehicle1: () => web3.eth.getBalancePromise(vehicle1),
            	vehicle2: () => web3.eth.getBalancePromise(vehicle2),
            	pendingCount12: () => operator.getPendingPaymentCount(booth1, booth2)
            });
          })
          .then(balances => {
          	assert.strictEqual(balances.operator.toNumber(), (price12 * multiplier1 + deposit1 * multiplier2));
            assert.strictEqual(balances.collected.toNumber(), price12 * multiplier1);
            assert.strictEqual(
              balances.vehicle1.toString(10),
              vehicleInitBal1.plus((deposit1 + extraDeposit - price12) * multiplier1).toString(10));
            assert.strictEqual(
            	balances.vehicle2.toString(10),
            	vehicleInitBal2.toString(10));
            assert.strictEqual(balances.pendingCount12.toNumber(), 1);
          })
          .then(() => operator.clearSomePendingPayments(booth1, booth2, 1, { from: owner1 }))
          .then(tx => {
          	assert.strictEqual(tx.receipt.logs.length, 1);
            assert.strictEqual(tx.logs.length, 1);
            const logExited = tx.logs[0];
            assert.strictEqual(logExited.event, "LogRoadExited");
            assert.strictEqual(logExited.args.exitBooth, booth2);
            assert.strictEqual(logExited.args.exitSecretHashed, hashed2);
            assert.strictEqual(logExited.args.finalFee.toNumber(), price12 * multiplier2);
            assert.strictEqual(logExited.args.refundWeis.toNumber(), (deposit1 - price12) * multiplier2);
            return Promise.allNamed({
            	operator: () => web3.eth.getBalancePromise(operator.address),
            	collected: () => operator.getCollectedFeesAmount(),
            	vehicle1: () => web3.eth.getBalancePromise(vehicle1),
            	vehicle2: () => web3.eth.getBalancePromise(vehicle2),
            	pendingCount12: () => operator.getPendingPaymentCount(booth1, booth2)
            });
          })
          .then(balances => {
          	assert.strictEqual(balances.operator.toNumber(), (price12 * multiplier1 + price12 * multiplier2));
            assert.strictEqual(balances.collected.toNumber(), (price12 * multiplier1 + price12 * multiplier2));
            assert.strictEqual(
              balances.vehicle1.toString(10),
              vehicleInitBal1.plus((deposit1 + extraDeposit - price12) * multiplier1).toString(10));
            assert.strictEqual(
            	balances.vehicle2.toString(10),
            	vehicleInitBal2.plus((deposit1 - price12) * multiplier2).toString(10));
            assert.strictEqual(balances.pendingCount12.toNumber(), 0);
          });
  		});
			
			it("should throw if trying to clear pending payment when none exists", function() {
				return operator.setRoutePrice(booth1, booth2, deposit1, { from: owner1 })
  				.then(tx => operator.enterRoad.call(booth1, hashed1, { from: vehicle1, value: deposit1 * multiplier1 }))
  				.then(success => assert.isTrue(success))
  				.then(() => operator.enterRoad(
  					booth1, hashed1, { from: vehicle1, value: deposit1 * multiplier1 }))
  				.then(tx => expectedExceptionPromise(
  					() => operator.clearSomePendingPayments(booth1, booth2, 1, { from: owner1, gas: 3000000 }), 3000000));
			});

  	});

  });
});
