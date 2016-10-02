var express = require('express');
var handlebars = require('express3-handlebars');
var formidable = require('formidable');
var jqupload = require('jquery-file-upload-middleware');
var fortune = require('./lib/fortune.js');
var credentials = require('./credentials.js');
var emailService = require('./lib/email.js')(credentials);

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

app.use(express.static(__dirname + '/public'));
app.use(function(req, res, next) {
  res.locals.showTests = app.get('env') !== 'production' &&
      req.query.test === '1';
      next();
});
app.use(require('body-parser')());
app.use(require('cookie-parser')(credentials.cookieSecret));
app.use(require('express-session')());

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

app.post('/process', function(req, res) {
  if(req.xhr || req.accepts('json, html') === 'json') {
    // if there were an error, we would send { error: 'error description' }
    res.send({ success: true });
  } else {
    // if there were an error, we would redirect to an error page
    res.redirect(303, '/thank-you');
  }
});

app.post('/contest/vacation-photo/:year/:month', function(req, res) {
  var form = new formidable.IncomingForm();
  form.parse(req, function(err, fields, files) {
    if(err) {
      return res.redirect(303, '/error');
    }
    console.log('received fields: ');
    console.log(fields);
    console.log('received files:');
    console.log(files);
    res.redirect(303, '/thank-you');
  });
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
  res.send('500');
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
