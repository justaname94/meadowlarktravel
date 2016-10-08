var attractionAPI = require('./handlers/rest_attraction.js');

module.exports = function(rest) {
  // Attractions API
  // TODO: Resolve route error between /attraction and
  // attracion/:id
  rest.get('/attraction',
    attractionAPI.get_api_attraction);
  rest.post('/attraction',
    attractionAPI.post_api_attraction);
  rest.get('/attraction/:id',
    attractionAPI.get_api_attraction_id);
};