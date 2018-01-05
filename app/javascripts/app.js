var app = angular.module('TollRoadApp', []);

import Regulator from '../../build/contracts/Regulator.json'
import TollBoothOperator from '../../build/contracts/TollBoothOperator.json'


// Configure preferences for Angular app
app.config(function( $locationProvider) {
  $locationProvider.html5Mode({
    enabled: true,
    requireBase: false
  });
});

// Define App Controller with Angular features
app.controller("TollRoadController",
  [ '$scope', '$location', '$http', '$q', '$window', '$timeout',
  function($scope, $location, $http, $q, $window, $timeout) {
    // everything we do will be inside the app controller
    var regulator;
    Regulator.deployed().then(function(instance) {
      regulator = instance;
      // newOperatorWatcher = watchForNewOperator();
    })

    // $scope.setVehicleType

    // $scope.newTollBoothOperator = function() {
      
    // }


    // work with the first account
    web3.eth.getAccounts(function(err, accs) {
      if (err != null) {
        alert("There was an error fetching you account.");
        return;
      }

      if (accs.length == 0) {
        alert("Couldn't get any accounts. Make sure your Ethereum client is configured correctly.");
        return;
      }

      $scope.accounts = accs;
      $scope.account = $scope.accounts[0];
      console.log("using account", $scope.account);

      web3.eth.getBalance($scope.account, function(err, _balance) {
        $scope.balance = _balance.toString(10);
        console.log("balance", $scope.balance);
        $scope.balanceInEth = web3.fromWei($scope.balance, "ether");
        $scope.$apply();
      })
      
    })
  }]);

