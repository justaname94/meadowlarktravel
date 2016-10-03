var express       = require('express');
var handlebars    = require('express3-handlebars');
var formidable    = require('formidable');
var jqupload      = require('jquery-file-upload-middleware');
var fs            = require('fs');
var mongoose      = require('mongoose');
var MongoSessionStore
                  = require('session-mongoose')(require('connect'));
var fortune       = require('./lib/fortune.js');
var credentials   = require('./credentials.js');
var emailService  = require('./lib/email.js')(credentials);
var Vacation      = require('./models/vacation.js');
var VacationInSeasonListener
                  = require('./models/vacationInSeasonListener.js');

var app = express();

switch(app.get('env')) {
  case 'development':
    // compact, colorful dev logging
    app.use(require('morgan')('dev'));
    break;
  case 'production':
    // module 'express-logger' supoorts daily log rotation
    app.use(require('express-logger')({
      path: __dirname + '/log/requests.log'
    }));
    break;
}

var opts = {
  server: {
    socketOptions: { keepAlive: 1 }
  }
};

switch(app.get('env')) {
  case 'development':
    mongoose.connect(credentials.mongodb.development.connectionString, opts);
    break;
  case 'production':
    mongoose.connect(credentials.mongodb.production.connectionString, opts);
    break;
  default:
    throw new Error('Unknown execution environment: ' + app.get('env'));
}

function getWeatherData() {
  return {
    locations: [
      {
        name: 'Portland',
        forecastUrl: 'http://www.wunderground.com/US/OR/Portland.html',
        iconUrl: 'http://icons-ak.wxug.com/i/c/k/cloudy.gif',
        weather: 'Overcast',
        temp: '54.1 F (12.3 C)'
      },
      {
        name: 'Bend',
        forecastUrl: 'http://www.wunderground.com/US/OR/Bend.html',
        iconUrl: 'http://icons-ak.wxug.com/i/c/k/partlycloudy.gif',
        weather: 'Partly Cloudy',
        temp: '55.0 F (12.8 C)'
      },
      {
        name: 'Manzanita',
        forecastUrl: 'http://www.wunderground.comUS/OR/Manzanita.html',
        iconUrl: 'http://icons-ak.wxug.com/i/c/k/rain.gif',
        weather: 'Light Rain',
        temp: '55.0 F (12.8 C)'
      }
    ]
  };
}

// use domains for better error handling
app.use(function(req, res, next){
    // create a domain for this request
    var domain = require('domain').create();
    // handle errors on this domain
    domain.on('error', function(err){
        console.error('DOMAIN ERROR CAUGHT\n', err.stack);
        try {
            // failsafe shutdown in 5 seconds
            setTimeout(function(){
                console.error('Failsafe shutdown.');
                process.exit(1);
            }, 5000);

            // disconnect from the cluster
            var worker = require('cluster').worker;
            if(worker) worker.disconnect();

            // stop taking new requests
            server.close();

            try {
                // attempt to use Express error route
                next(err);
            } catch(error){
                // if Express error route failed, try
                // plain Node response
                console.error('Express error mechanism failed.\n', error.stack);
                res.statusCode = 500;
                res.setHeader('content-type', 'text/plain');
                res.end('Server error.');
            }
        } catch(error){
            console.error('Unable to send 500 response.\n', error.stack);
        }
    });
    // add the request and response objects to the domain
    domain.add(req);
    domain.add(res);

    // execute the rest of the request chain in the domain
    domain.run(next);
});

app.use(function(req, res, next) {
  if(!res.locals.partials) {
    res.locals.partials = {};
  }
  res.locals.partials.weather = getWeatherData();
  next();
});

// Disable "X-Powered-By" response header
app.disable('x-powered-by');

// set up handlebars view engine
app.engine('handlebars', handlebars({
  defaultLayout: 'main',
  helpers: {
    section: function(name, options) {
      if(!this._sections) {
        this._sections = {};
      }
      this._sections[name] = options.fn(this);
      return null;
    }
  }
}));
app.set('view engine', 'handlebars');


var MongoSessionStore
                  = require('session-mongoose')(require('connect'));
var sessionStore = new MongoSessionStore({
  url: credentials.mongodb[app.get('env')].connectionString
});

app.use(express.static(__dirname + '/public'));
app.use(function(req, res, next) {
  res.locals.showTests = app.get('env') !== 'production' &&
      req.query.test === '1';
      next();
});
app.use(require('body-parser')());
app.use(require('cookie-parser')(credentials.cookieSecret));
app.use(require('express-session')( { store: sessionStore} ));

app.use(function(req, res, next) {
  // if there's a flash message, transfer
  // it to the context, then clear it
  res.locals.flash = req.session.flash;
  delete req.session.flash;
  next();
});

app.use('/upload', function(req, res, next) {
  var now = Date.now();
  jqupload.fileHandler({
    uploadDir: function() {
      return __dirname + '/public/uploads/' + now;
    },
    uploadUrl: function() {
      return '/uploads/' + now;
    }
  })(req, res, next);
});

app.set('port', process.env.PORT || 3000);

app.get('/', function(req, res) {
  res.render('home');
  res.cookie('signed_monster', 'nom nom', { signed: true });
});

app.get('/about', function(req, res) {
  res.render('about', {
    fortune: fortune.getFortune(),
    pageTestScript: '/qa/tests-about.js'
  });
});

app.get('/tours/hood-river', function(req, res) {
  res.render('tours/hood-river');
});

app.get('/tours/oregon-coast', function(req, res) {
  res.render('tours/oregon-coast');
});

app.get('/tours/request-group-rate', function(req, res) {
  res.render('tours/request-group-rate');
});

app.get('/jquery-test', function(req, res) {
  res.render('jquery-test');
});

app.get('/nursery-rhyme', function(req, res) {
  res.render('nursery-rhyme');
});

app.get('/data/nursery-rhyme', function(req, res) {
  res.json({
    animal: 'squirrel',
    bodyPart: 'tail',
    adjective: 'bushy',
    noun: 'heck'
  });
});

app.get('/thank-you', function(req, res) {
  res.render('thank-you');
});

app.get('/newsletter', function(req, res) {
  res.render('newsletter', { csrf: 'CSRF token goes here'} );
});

app.get('/contest/vacation-photo', function(req, res) {
  var now = new Date();
  res.render('contest/vacation-photo', {
    year: now.getFullYear(),
    month: now.getMonth()
  });
});

// make sure data directory exists
var dataDir = __dirname + '/data';
var vacationPhotoDir = dataDir + '/vacation-photo';
fs.existsSync(dataDir) || fs.mkdirSync(dataDir);
fs.existsSync(vacationPhotoDir) || fs.mkdirSync(vacationPhotoDir);

function saveContestEntry(constestName, email, year, month, photoPath) {
  // TODO: This will come later
}

app.post('/contest/vacation-photo/:year/:month', function(req, res) {
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
});

app.get('/set-currency/:currency', function(req, res) {
  req.session.currency = req.params.currency;
  return res.redirect(303, '/vacations');
});

function convertFromUSD(value, currency) {
  switch(currency) {
    case 'USD': return value * 1;
    case 'GBP': return value * 0.6;
    case 'BTC': return value * 0.0023707918444761;
    default: return NaN;
  }
}

app.get('/vacations', function(req, res){
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
});

app.get('/notify-me-when-in-season', function(req, res) {
  res.render('notify-me-when-in-season', { sku: req.query.sku });
});

app.post('/notify-me-when-in-season', function(req, res) {
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
});

app.get('/fail', function(req, res) {
  throw new Error('Nope!');
});

app.get('/epic-fail', function(req, res) {
  process.nextTick(function() {
    throw new Error('Kaboom!');
  });
});

app.post('/process', function(req, res) {
  if(req.xhr || req.accepts('json, html') === 'json') {
    // if there were an error, we would send { error: 'error description' }
    res.send({ success: true });
  } else {
    // if there were an error, we would redirect to an error page
    res.redirect(303, '/thank-you');
  }
});

app.post('/cart/checkout', function(req, res, next) {
  var cart = req.session.cart;
  if (!cart) {
    next(new Error('Cart does not exist.'));
  }
  var name = req.body.name || '';
  var email = req.body.email || '';
  // input validation
  if (!email.match(VALID_EMAIL_REGEX)) {
    return res.next(new Error('Invalid email address'));
  }
  // assign a random cart ID; normally we would use a database ID here
  cart.number = Math.random().toString().replace(/^0.0*/, '');
  cart.billing = {
    name: name,
    email: email,
  };

  res.render('email/cart-thank-you.html', {
    layout: null,
    cart: cart
  }, function(err, html) {
    if ( err ) console.log('error in email template');
    emailService.send('cvbot2@gmail.com',
      'Thank You for Book your Trip with Meadowlark', html);
  });
  res.render('cart-thank-you', { cart: cart });
});

// See Request Headers
app.get('/headers', function(req, res) {
  res.set('Content-type', 'text/plain');
  var s = '';
  for (var name in req.headers) {
    s += name + ': ' + req.headers[name] + '\n';
  }
  res.send(s);
});

// custom 404 page
app.use(function(req, res) {
  res.status(404);
  res.send('404');
});

// custom 500 page
app.use(function(err, req, res, next) {
  console.error(err.stack);
  res.status(500);
  res.render('500');
});

function startServer() {
  app.listen(app.get('port'), function() {
    console.log('Express started in ' + app.get('env') +
      'mode on http://localhost:' + app.get('port') +
      '; press CTRC-C to terminate');
  });
}

if (require.main === module) {
  // application run directly; start app server
  startServer();
} else {
  // application imported as a module via "require"; export
  // function to create server
  module.exports = startServer;
}
