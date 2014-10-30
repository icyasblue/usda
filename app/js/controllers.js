'use strict';

/* Controllers */

function navCtrl($scope, $rootScope, $http, $location) {
    $scope.projects = {};
    $http.get('/projects').
        success(function(data) {
            $scope.projects = data;
        });
    $scope.openProject = function(proc) {
        $location.path('/project/' + proc);
    }
}

function CtrlMain() {}

function CtrlProject($scope, $http, $routeParams, $modal) {
    $scope.proc = $routeParams.proc;
    $scope.commits = [];
    $http.get('/queue/' + $scope.proc).
        success(function(data) {
            $scope.commits = data;
            $scope.cc = data.filter(function(x) { return x.priority == -1; });
        });
    $scope.isEmpty = function(c) {
        return !jQuery.isEmptyObject(c)
    }

    $scope.openModal = function (commit) {
      $scope.currentCommit = commit;
      var modalInstance = $modal.open({
        templateUrl: 'myModalContent.html',
        controller: ModalInstanceCtrl,
        size: 'lg',
        resolve: {
          currentCommit: function () { return $scope.currentCommit; }
          }
      });
      modalInstance.result.then(function () {
        $http.get('/queue/' + $scope.proc).
            success(function(data) {
                $scope.commits = data;
                $scope.cc = data.filter(function(x) { return x.priority == -1; });
            });
      });
    };
};

function ModalInstanceCtrl ($scope, $http, $modalInstance, currentCommit) {

  $scope.currentCommit = currentCommit;
  $scope.boost = function () {
    $http.get('/boost/' + currentCommit.change_id).
      success(function (data) {
        $modalInstance.close();
      });
  };

  $scope.cancel = function () {
    $modalInstance.dismiss('cancel');
  };

  $scope.canBoost = function() {
    return $scope.currentCommit.priority == 0;
  }
};

function CtrlStats($scope, $http) {
  $scope.stats = [];
  $http.get('/performance').
    success(function(data) {
        $scope.stats = data;
    });
};

function CtrlUsers($scope, $http) {
  $scope.users = [];
  $http.get('/users').
    success(function(data) {
      $scope.users = data;
    });
};

function CtrlRanks($scope, $http) {
  $scope.merged = {
    all: [],
    repo1: [],
    repo2: [],
    repo3: []
  };
  $scope.mergedTableDef = [
    {
      columnHeaderDisplayName: 'Name',
      displayProperty: 'name'
    },
    {
      columnHeaderDisplayName: 'Merged',
      displayProperty: 'count'
    }
  ];
  $http.get('/rank/merged/all/7').
  success(function (result) {
    $scope.merged.all = result;
  });
  $http.get('/rank/merged/repo1/7').
  success(function (result) {
    $scope.merged.repo1 = result;
  });
  $http.get('/rank/merged/repo2/7').
  success(function (result) {
    $scope.merged.repo2 = result;
  });
  $http.get('/rank/merged/repo3/7').
  success(function (result) {
    $scope.merged.repo3 = result;
  });

  $scope.reviewed = {
    all: [],
    repo1: [],
    repo2: [],
    repo3: []
  }
  $scope.reviewedTableDef = [
    {
      columnHeaderDisplayName: 'Name',
      displayProperty: 'name'
    },
    {
      columnHeaderDisplayName: 'Reviewed',
      displayProperty: 'count'
    }
  ];
  $http.get('/rank/reviews/all/7/all').
  success(function (result) {
    $scope.reviewed.all = result;
  });
  $http.get('/rank/reviews/repo1/7/all').
  success(function (result) {
    $scope.reviewed.repo1 = result;
  });
  $http.get('/rank/reviews/repo2/7/all').
  success(function (result) {
    $scope.reviewed.repo2 = result;
  });
  $http.get('/rank/reviews/repo3/7/all').
  success(function (result) {
    $scope.reviewed.repo3 = result;
  });
}