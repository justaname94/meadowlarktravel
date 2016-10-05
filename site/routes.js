var main          = require('./handlers/main.js');
var tours         = require('./handlers/tours.js');
var vacations     = require('./handlers/vacations.js');
var staff         = require('./handlers/staff.js');
var other         = require('./handlers/other.js');

module.exports = function(app) {
  // home
  app.get('/', main.home);
  app.get('/about', main.about);

  // tours
  app.get('/tours/hood-river', tours.hood_river);
  app.get('/tours/oregon-coast', tours.oregon_coast);

  // vacations
  app.post('/contest/vacation-photo/:year/:month',
    vacations.contest_vacation_year_month);
  app.get('/set-currency/:currency',
    vacations.set_currency_currency);
  app.get('/vacations', vacations.vacations);
  app.get('/notify-me-when-in-season',
    vacations.get_notify_me_when_in_season);
  app.post('/notify-me-when-in-season',
    vacations.post_notify_me_when_in_season);

  // staff
  app.get('/staff', staff.staff);
  app.get('/staff/:name', staff.staff_name);

  // other
  app.get('/thank-you', other.thank_you);
  app.get('/newsletter', other.newsletter);
  app.get('/contest/vacation-photo',
    other.contest_vacation_photo);
  app.post('/process', other.post_process);
};