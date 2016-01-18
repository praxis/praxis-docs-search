app.value('pathIndex', {});
app.provider('praxisDocsSearch', function() {
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
            function extractMembers(thing) {
              return _.map(_.get(thing, 'type.attributes', {}), function(v, k) {
                var res = [k];
                if (v.description) {
                  res.push(v.description);
                }
                if (_.get(v, 'type.attributes')) {
                  res = res.concat(extractMembers(v));
                }
                return res.join(' ');
              }).join(' ');
            }
            function extractActionMembers(action) {
              var headers = _.keys(_.get(action, 'headers.type.attributes', {})).join(' '),
                  params  = extractMembers(_.get(action, 'params', {})),
                  payload = extractMembers(_.get(action, 'payload', {})),
                  responses = _.map(_.get(action, 'responses'), function(v, k) { return k + ' ' + v.description; }).join(' '),
                  urls = _.map(_.get(action, 'urls'), 'path').join(' ');
              return [headers, params, payload, responses, urls].join(' ');
            }
            function extractTypeMembers(type) {
              return extractMembers({type: type});
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
            _.each(items.schemas, function(type) {
              var href = $state.href('root.type', {version: version, type: type.id});
              index.add({
                path: href,
                titleWords: type.display_name,
                members: extractTypeMembers(type),
                keywords: type.description + ' ' + version
              });
              pathIndex[href] = {
                type: 'schema',
                name: type.display_name,
                id: type.id,
                version: version
              };
            });

            _.each(items.traits, function(trait, id) {
              var href = $state.href('root.trait', {version: version, trait: id});
              index.add({
                path: href,
                titleWords: id,
                members: extractTypeMembers(trait),
                keywords: trait.description + ' ' + version
              });
              pathIndex[href] = {
                type: 'trait',
                name: id,
                id: id,
                version: version
              };
            });
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

app.controller('DocsSearchCtrl', function($scope, $location, praxisDocsSearch, pathIndex, $timeout) {

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

  $scope.goToResult = function(result) {
    var str = $scope.q;
    $scope.hideResults();
    $timeout(function() {
      if (window.find) {        // Firefox, Google Chrome, Safari
        // if some content is selected, the start position of the search
        // will be the end position of the selection
        window.find(str, false, false, true);
      } else {
        if (document.selection && document.selection.createRange) { // Internet Explorer, Opera before version 10.5
          var textRange = document.selection.createRange ();
          if (textRange.findText) {   // Internet Explorer
            // if some content is selected, the start position of the search
            // will be the position after the start position of the selection
            if (textRange.text.length > 0) {
              textRange.collapse(true);
              textRange.mov("character", 1);
            }
            if (textRange.findText(str)) {
              textRange.select();
            }
          }
        }
      }
    }, 200);
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
  };
});
