app.value('pathIndex', {});
app.provider('praxisDocsSearch', function() {
  // This version of the service builds the index in the current thread,
  // which blocks rendering and other browser activities.
  // It should only be used where the browser does not support WebWorkers
  function localSearchFactory(Documentation, $timeout, $q, $state, pathIndex) {
    'ngInject';
    console.log('Using Local Search Index');

    // Create the lunr index
    var index = lunr(function() {
      this.ref('path');
      this.field('titleWords', {boost: 50});
      this.field('members', {boost: 40});
      this.field('keywords', {boost: 20});
      this.field('parent', {boost: 30});
    });

    // Delay building the index by loading the data asynchronously
    var indexReadyPromise = Documentation.versions().then(function(versions) {
      // Delay building the index for 500ms to allow the page to render
      return $timeout(function() {
        $q.all(versions.map(function (version) {
          return Documentation.items(version).then(function(items) {
            function extractActionMembers(action) {
              // TODO: Fill this out more properly
              return _.keys(_.get(action, 'headers.type.attributes', {})).join(' ');
            }
            _.each(items.resources, function(resource, id) {
              var href = $state.href('root.controller', {version: version, controller: id});
              index.add({
                path: href,
                titleWords: resource.display_name,
                members: _.map(resource.actions, 'name').join(' ') + ' ' + _.get(resource.media_type, 'name') + ' ' + _.get(resource, 'traits', []).join(' '),
                keywords: resource.description + ' ' + version,
                parent: resource.parent ? items.resources[resource.parent].display_name : ''
              });
              pathIndex[href] = {
                type: 'resource',
                name: resource.display_name,
                id: id,
                version: version
              };

              _.each(resource.actions, function(action) {
                var href = $state.href('root.action', {version: version, controller: id, action: action.name});
                index.add({
                  path: $state.href('root.action', {version: version, controller: id, action: action.name}),
                  titleWords: action.name,
                  members: extractActionMembers(action),
                  keywords: action.description + ' ' + version,
                  parent: resource.display_name
                });

                pathIndex[href] = {
                  type: 'action',
                  name: resource.display_name + ' » ' + action.name,
                  id: action.name,
                  version: version,
                  resource: id
                };
              });
            });
            // TODO: Add types and traits in here
          });
        }));
      }, 500);
    });

    // The actual service is a function that takes a query string and
    // returns a promise to the search results
    // (In this case we just resolve the promise immediately as it is not
    // inherently an async process)
    return function(q) {
      return indexReadyPromise.then(function() {
        return index.search(q);
      });
    };
  }

  return {
    $get:localSearchFactory //window.Worker ? webWorkerSearchFactory : localSearchFactory
  };
});

app.controller('DocsSearchCtrl', function($scope, $location, praxisDocsSearch, pathIndex) {

  function clearResults() {
    $scope.results = [];
    $scope.showResults = false;
    $scope.colClassName = null;
    $scope.hasResults = false;
  }

  clearResults();
  $scope.focus = false;

  $scope.search = function(q) {
    var MIN_SEARCH_LENGTH = 2;
    if(q.length >= MIN_SEARCH_LENGTH) {
      praxisDocsSearch(q).then(function(hits) {
        $scope.hasResults = hits.length > 0;
        $scope.results = _.map(_.take(hits, 10), function(hit) {
          var result = pathIndex[hit.ref];
          result.path = hit.ref;
          return result;
        });
      });
    } else {
      clearResults();
    }
    if(!$scope.$$phase) $scope.$apply();
  };

  $scope.submit = function() {
    var result;
    for(var i in $scope.results) {
      result = $scope.results[i];
      if(result) {
        break;
      }
    }
    if(result) {
      $location.path(result.path);
      $scope.hideResults();
    }
  };

  $scope.hideResults = function() {
    clearResults();
    $scope.q = '';
  };

  $scope.$watch('focus && hasResults', function(val) {
    $scope.showResults = val;
  });
});

app.directive('searchForm', function() {
  return {
    restrict: 'E',
    controller: 'DocsSearchCtrl',
    templateUrl: 'views/search_form.html'
  }
});
