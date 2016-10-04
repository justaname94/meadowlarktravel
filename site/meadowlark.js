var express       = require('express');
var handlebars    = require('express3-handlebars');
var fs            = require('fs');
var mongoose      = require('mongoose');
var MongoSessionStore
                  = require('session-mongoose')(require('connect'));
var credentials   = require('./credentials.js');
var weatherData   = require('./lib/weatherdata.js');
var emailService  = require('./lib/email.js')(credentials);

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
  res.locals.partials.weather = weatherData.getWeatherData();
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

app.set('port', process.env.PORT || 3000);

// Handle all the incoming requests
require('./routes.js')(app);

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
