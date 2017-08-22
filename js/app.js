var tlDocsApp = angular.module("tlDocsApp", [ "ngRoute" ])
  .run(function($rootScope, $location){
    $rootScope.doSearch = function() {
      $location.path("/")
    }
  })

tlDocsApp.value("schema", SCHEMA_GLOBAL)
tlDocsApp.value("layerVersion", LAYER_NUMBER)

tlDocsApp.filter("toHex", function() {
  return function(number) {
    number = parseInt(number)
    if (number < 0) number = 0xFFFFFFFF + number + 1
    return number.toString(16).toLowerCase()
  }
})

tlDocsApp.filter("actualType", function() {
  return function(type) {
    if(type.indexOf("Vector<") !== -1)
      return /Vector\<(.+)\>/i.exec(type)[1]
    
    if(type.indexOf("flags") === 0)
      return type.split("?")[1]
    else
      return type
  }
})

tlDocsApp.filter("htmlType", function() {
  return function(type) {
    if(type.toLowerCase().indexOf("int") !== -1 || type.toLowerCase().indexOf("long") !== -1) {
      return "number"
    } else if(type.toLowerCase().indexOf("bool") !== -1 || type.toLowerCase().indexOf("true") !== -1 || type.toLowerCase().indexOf("false") !== -1) {
      return "checkbox"
    } else if(type.toLowerCase().indexOf("string") !== -1) {
      return "text"
    } else {
      return "hidden"
    }
  }
})

// https://stackoverflow.com/a/17472118
tlDocsApp.directive('myEnter', function () {
  return function (scope, element, attrs) {
    element.bind("keydown keypress", function (event) {
      if(event.which === 13) {
        scope.$apply(function (){
          scope.$eval(attrs.myEnter)
        })
        event.preventDefault()
      }
    })
  }
})

tlDocsApp.directive('myArrowDown', function () {
  return function (scope, element, attrs) {
    element.bind("keydown keypress", function (event) {
      if(event.which === 40) {
        scope.$apply(function (){
          scope.$eval(attrs.myArrowDown)
        })
        event.preventDefault()
      }
    })
  }
})

tlDocsApp.directive('myArrowUp', function () {
  return function (scope, element, attrs) {
    element.bind("keydown keypress", function (event) {
      if(event.which === 38) {
        scope.$apply(function (){
          scope.$eval(attrs.myArrowUp)
        })
        event.preventDefault()
      }
    })
  }
})

tlDocsApp.factory("SchemaService", function(schema) {
  return {
    findMethod: function(name) {
      return schema.methods.filter(method => method.method === name)[0]
    },
    findConstructor: function(name) {
      return schema.constructors.filter(constr => constr.predicate === name)[0]
    },
    findType: function(name) {
      return schema.types.filter(type => type.name === name)[0]
    },
    search: function(term) {
      var results = [ ]

      schema.methods.forEach(method => {
        if(method.method.toLowerCase().indexOf(term.toLowerCase()) !== -1) {
          var result = {
            type: "method",
            name: method.method,
            relevancy: method.method.toLowerCase().indexOf(term.toLowerCase()) === 0 ? 1 : 0,
            indexOfSearch: method.method.toLowerCase().indexOf(term.toLowerCase())
          }

          results.push(result)
        }
      })

      schema.constructors.forEach(constr => {
        if(constr.predicate.toLowerCase().indexOf(term.toLowerCase()) !== -1) {
          var result = {
            type: "constructor",
            name: constr.predicate,
            relevancy: constr.predicate.toLowerCase().indexOf(term.toLowerCase()) === 0 ? 1 : 0,
            indexOfSearch: constr.predicate.toLowerCase().indexOf(term.toLowerCase())
          }

          results.push(result)
        }
      })

      schema.types.forEach(type => {
        if(type.name.toLowerCase().indexOf(term.toLowerCase()) !== -1) {
          var result = {
            type: "type",
            name: type.name,
            relevancy: type.name.toLowerCase().indexOf(term.toLowerCase()) === 0 ? 1 : 0,
            indexOfSearch: type.name.toLowerCase().indexOf(term.toLowerCase())
          }

          results.push(result)
        }
      })

      return results.sort((a, b) => {
        if(a.relevancy < b.relevancy)
          return 1
        if(a.relevancy > b.relevancy)
          return -1
        return 0
      })
    }
  }
})

tlDocsApp.config(function($routeProvider, $locationProvider) {
  $routeProvider
    .when("/", {
      templateUrl: "/views/index.html",
      controller: "mainController"
    })
    .when("/constructor/:predicate", {
      templateUrl: "/views/constructors/show.html",
      controller: "viewConstructorController"
    })
    .when("/method/:method", {
      templateUrl: "/views/methods/show.html",
      controller: "viewMethodController"
    })
    .when("/type/:type", {
      templateUrl: "/views/types/show.html",
      controller: "viewTypeController"
    })
    .otherwise({
      redirectTo: "/"
    })
  
  $locationProvider.html5Mode(false)
})

tlDocsApp.controller("mainController", function($scope, $rootScope, $location, schema, layerVersion, SchemaService) {
  $rootScope.hideGlobalSearch = true

  $scope.title = "TL-Schema Explorer"
  $scope.schema = schema
  $scope.layer = layerVersion
  $scope.displayTypeahead = false

  $scope.searchPlaceholder = $scope.schema.methods[Math.floor(Math.random() * $scope.schema.methods.length)].method

  $scope.selectedResult = 0

  setInterval(function() {
    $scope.searchPlaceholder = $scope.schema.methods[Math.floor(Math.random() * $scope.schema.methods.length)].method
    $scope.$apply()
  }, 5000)

  $scope.updateSearchResults = function() {
    $scope.selectedResult = 0
    $scope.typeaheadResults = SchemaService.search($scope.search)
    if($scope.search.length === 0) $scope.typeaheadResults = [ ]
  }

  $scope.goToResult = function() {
    var result = $scope.typeaheadResults[$scope.selectedResult]
    $location.path(`/${result.type}/${result.name}`)
  }

  $scope.clickResult = function(result) {
    $location.path(`/${result.type}/${result.name}`)
  }

  if($rootScope.globalSearch) {
    $scope.search = $rootScope.globalSearch
    document.getElementById("heroSearchBar").focus()
    $scope.updateSearchResults()
    $rootScope.globalSearch = ""
  }

  // limits
  $scope.methodListingLimit = 10
  $scope.constructorListingLimit = 10
  $scope.typeListingLimit = 10
})

tlDocsApp.controller("viewConstructorController", function($scope, $routeParams, $location, $rootScope, SchemaService) {
  $rootScope.hideGlobalSearch = false
  $scope.playgroundVals = { }
  $scope.playgroundOutput = ""

  $scope.constructor = SchemaService.findConstructor($routeParams.predicate)
  if(!$scope.constructor) $location.path("/")

  $scope.updatePlayground = function() {
    var example = { flags: 0, _: $scope.constructor.predicate }

    $scope.constructor.params.forEach(param => {
      if($scope.playgroundVals[param.name] && param.type.indexOf("flags.") === 0)
        example.flags = example.flags | parseInt(/flags\.([0-9]+)/g.exec(param.type)[1])
        
      example[param.name] = $scope.playgroundVals[param.name] || null
    })

    $scope.playgroundOutput = JSON.stringify(example, null, 2)
  }

  $scope.updatePlayground()
})

tlDocsApp.controller("viewMethodController", function($scope, $routeParams, $location, $rootScope, SchemaService) {
  $rootScope.hideGlobalSearch = false
  
  $scope.method = SchemaService.findMethod($routeParams.method)
  if(!$scope.method) $location.path("/")

  $scope.playgroundVals = { }
  $scope.playgroundOutput = ""

  $scope.updatePlayground = function() {
    var example = { flags: 0 }

    $scope.method.params.forEach(param => {
      if($scope.playgroundVals[param.name] && param.type.indexOf("flags.") === 0)
        example.flags = example.flags | parseInt(/flags\.([0-9]+)/g.exec(param.type)[1])

      example[param.name] = $scope.playgroundVals[param.name] || null
    })

    $scope.playgroundOutput = JSON.stringify(example, null, 2)
  }

  $scope.updatePlayground()
})

tlDocsApp.controller("viewTypeController", function($scope, $routeParams, $location, $rootScope, SchemaService) {
  $rootScope.hideGlobalSearch = false

  $scope.type = SchemaService.findType($routeParams.type)
  if(!$scope.type) $location.path("/")
})