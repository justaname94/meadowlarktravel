exports.util_customerOnly = function(req, res) {
  var user = req.session.passport.user;
  if (user && req.role === 'customer') {
    return next();
  }
  res.redirect(303, '/unauthorized');
};

exports.util_employeeOnly = function(req, res) {
  var user = req.session.passport.user;
  if (user && req.role === 'employee') {
    return next();
  }
  next('route');
};

// customer routes
exports.account = function(req, res) {
  if(!req.session.passport.user) {
    return res.redirect(303, '/unauthorized');
  }
  res.render('account');
};

exports.account_order_history = function(req, res) {
  res.render('account/order-history');
};

exports.account_email_prefs = function(req, res) {
  res.render('account/email-prefs');
};

// employer routes
exports.sales = function(req, res) {
  res.render('sales');
};