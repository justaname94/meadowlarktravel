var attractionAPI = require('./handlers/rest_attraction.js');

module.exports = function(rest) {
  // Attractions API
  rest.get('/attraction',
    attractionAPI.get_api_attraction);
  rest.post('/attraction',
    attractionAPI.post_api_attraction);
  rest.get('/attraction/:id',
    attractionAPI.get_api_attraction_id);
};