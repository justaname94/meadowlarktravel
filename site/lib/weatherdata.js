var http = require('http');
var Q    = require('q');
var credentials = require('../credentials');

var getWeatherData = (function() {
  // our weather cache
  var c = {
    refreshed: 0,
    refreshing: false,
    updateFrequency: 360000, // 1 hour
    locations: [
      { name: 'Portland'},
      { name: 'Bend'},
      { name: 'Manzanita' }
    ]
  };
  return function() {
    if ( !c.refreshing && Date.now() > c.refreshed + c.updateFrequency) {
      c.refreshing = true;
      var promises = [];
      c.locations.forEach(function(loc) {
        var deferred = Q.defer();
        var url = 'http://api.wunderground.com/api/' +
          credentials.WeatherUnderground.ApiKey +
          '/conditions/q/OR/' + loc.name + '.json';
        http.get(url, function(res) {
          var body = '';
          res.on('data', function(chunk) {
            body += chunk;
          });
          res.on('end', function() {
            body = JSON.parse(body);
            loc.forecastUrl = body.current_observation.forecast_url;
            loc.iconUrl = body.current_observation.icon_url;
            loc.weather = body.current_observation.weather;
            loc.temp = body.current_observation.temperature_string;
            deferred.resolve();
          });
        });
        promises.push(deferred);
      });
      Q.all(promises).then(function() {
        c.refreshing = false;
        c.refreshed = Date.now();
      });
    }
    return { locations: c.locations };
  };
})();

// initialize weather cache
getWeatherData();
module.exports = getWeatherData();
