var fs         = require('fs');
var Vacation   = require('../models/vacation.js');
var VacationInSeasonListener
               = require('../models/vacationInSeasonListener.js');

// make sure data directory exists
var dataDir = __dirname + '/data';
var vacationPhotoDir = dataDir + '/vacation-photo';
// fs.existsSync(dataDir) || fs.mkdirSync(dataDir);
// fs.existsSync(vacationPhotoDir) || fs.mkdirSync(vacationPhotoDir);

function saveContestEntry(constestName, email, year, month, photoPath) {
  // TODO: This will come later
}

function convertFromUSD(value, currency) {
  switch(currency) {
    case 'USD': return value * 1;
    case 'GBP': return value * 0.6;
    case 'BTC': return value * 0.0023707918444761;
    default: return NaN;
  }
}

exports.contest_vacation_year_month = function(req, res) {
  var form = new formidable.IncomingForm();
  form.parse(req, function(err, fields, files) {
    if(err) {
      return res.redirect(303, '/error');
    }
    if (err) {
      res.session.flash = {
        type: 'danger',
        intro: 'Oops!',
        message: 'There was an error processing your submission. ' +
          'Please try again.'
      };
      res.redirect(303, '/contest/vacation-photo');
    }
    var photo = files.photo;
    var dir = vacationPhotoDir + '/' + Date.now();
    var path = dir + '/' + photo.name;
    fs.mkdirSync(dir);
    fs.renameSync(photo.path, dir + '/' + photo.name);
    saveContestEntry('vacation-photo', fields.email,
      req.params.year, req.params.month, path);
    req.session.flash = {
      type: 'sucess',
      intro: 'Good luck!',
      message: 'You have been entered into the contest.'
    };
    return res.redirect(303, '/contest/vacation-photo/entries');
  });
};

exports.set_currency_currency = function(req, res) {
  req.session.currency = req.params.currency;
  return res.redirect(303, '/vacations');
};

exports.vacations = function(req, res) {
  Vacation.find({ available: true }, function(err, vacations){
  var currency = req.session.currency || 'USD';
  var context = {
    vacations: vacations.map(function(vacation){
      return {
        sku: vacation.sku,
        name: vacation.name,
        description: vacation.description,
        inSeason: vacation.inSeason,
        price: convertFromUSD(vacation.priceInCents/100, currency),
        qty: vacation.qty,
      };
    })
  };
  switch(currency) {
    case 'USD': context.currencyUSD = 'selected'; break;
    case 'GBP': context.currencyGBP = 'selected'; break;
    case 'BTC': context.currencyBTC = 'selected'; break;
  }
  res.render('vacations', context);
  });
};

exports.get_notify_me_when_in_season = function(req, res) {
  res.render('notify-me-when-in-season', { sku: req.query.sku });
};

exports.post_notify_me_when_in_season = function(req, res) {
  VacationInSeasonListener.update(
    { email: req.body.email },
    { $push: { skus: req.body.sku} },
    { upsert: true },
    function(err) {
      if (err) {
        console.error(err.stack);
        req.session.flash = {
          type: 'danger',
          intro: 'Ooops!',
          message: 'There was an error processing your request'
        };
        return res.redirect(303, '/vacations');
      }
      req.session.flash = {
        type: 'success',
        intro: 'Thank you!',
        message: 'You will be notified when this vacation is in season'
      };
      return res.redirect(303, '/vacations');
    }
  );
};