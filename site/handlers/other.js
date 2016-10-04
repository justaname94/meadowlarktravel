exports.thank_you = function(req, res) {
  res.render('thank-you');
};

exports.newsletter = function(req, res) {
  res.render('newsletter',
    { csrf: 'CSRF token goes here'} );
};

exports.contest_vacation_photo = function(req, res) {
  var now = new Date();
  res.render('contest/vacation-photo', {
    year: now.getFullYear(),
    month: now.getMonth()
  });
};

exports.post_process = function(req, res) {
  if(req.xhr || req.accepts('json, html') === 'json') {
    // if there were an error, we would send { error: 'error description' }
    res.send({ success: true });
  } else {
    // if there were an error, we would redirect to an error page
    res.redirect(303, '/thank-you');
  }
};