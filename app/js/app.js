'use strict';

/* App Module */

var USDAApp = angular.module('USDA', [
  'ngRoute',
  'ui.bootstrap',
  'ngSanitize',
  'adaptv.adaptStrap'
  ]);

USDAApp.config(['$routeProvider', function($routeProvider) {
  $routeProvider.when('/main', {
    templateUrl: 'partials/main.html',
    controller: CtrlMain
  }).
  when('/stats', {
    templateUrl: 'partials/stats.html',
    controller: CtrlStats
  }).
  when('/project/:proc', {
    templateUrl: 'partials/project.html',
    controller: CtrlProject
  }).
  when('/users', {
    templateUrl: 'partials/users.html',
    controller: CtrlUsers
  }).
  when('/ranks', {
    templateUrl: 'partials/ranks.html',
    controller: CtrlRanks
  }).
  otherwise({
    redirectTo: '/main'
  })
}]);