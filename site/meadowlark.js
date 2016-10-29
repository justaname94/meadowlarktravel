var express       = require('express');
var https         = require('https');
var handlebars    = require('express3-handlebars');
var fs            = require('fs');
var mongoose      = require('mongoose');
var MongoSessionStore
                  = require('session-mongoose')(require('connect'));
var rest          = require('connect-rest');
var Q             = require('q');
var credentials   = require('./credentials.js');
var weatherData   = require('./lib/weatherdata.js');
var emailService  = require('./lib/email.js')(credentials);
var twitter       = require('./lib/twitter')({
    consumerKey: credentials.twitter.consumerKey,
    consumerSecret: credentials.twitter.consumerSecret
});
var Dealer        = require('./models/dealer.js');
var app = express();

switch(app.get('env')) {
  case 'development':
    // compact, colorful dev logging
    app.use(require('morgan')('dev'));

    mongoose.connect(credentials.mongodb.development.connectionString, opts);
    break;
  case 'production':
    // module 'express-logger' supoorts daily log rotation
    app.use(require('express-logger')({
      path: __dirname + '/log/requests.log'
    }));

    mongoose.connect(credentials.mongodb.production.connectionString, opts);
    break;
}

var opts = {
  server: {
    socketOptions: { keepAlive: 1 }
  }
};

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
  res.locals.partials.weather = weatherData;
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
    },
    static: function(name) {
      return require('./lib/static.js').map(name);
    }
  }
}));
app.set('view engine', 'handlebars');

// Set up js/css bundling
var bundler = require('connect-bundle')(require('./config.js'));
app.use(bundler);

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

// Protect from CSRF Attacks by using tokens to verify
// requests source
// app.use(require('cusrf')());
// app.use(function(req, res, next) {
//   res.locals._csrfToken = req.csrfToken();
//   next();
// });

// Allow other websites to access the API
app.use(require('cors')());
app.use('/api', require('cors')());

app.use(function(req, res, next) {
  // if there's a flash message, transfer
  // it to the context, then clear it
  res.locals.flash = req.session.flash;
  delete req.session.flash;
  next();
});

// Passport setup for user authentication
var auth = require('./lib/auth.js')(app, {
  providers: credentials.authProviders,
  successRedirect: '/account',
  failureRedirect: '/unauthorized'
});
// auth.init() links in Passport middleware
auth.init();

// now we can specify our auth routes
auth.registerRoutes();

app.set('port', process.env.PORT || 3000);

// Handle Website routes
require('./routes.js')(app);

// automatic views rendering

var autoViews = {};

app.use(function(req, res, next) {
  var path = req.path.toLowerCase();
  // check cache; if it's there, render the view
  if (autoViews[path]) return res.render(autoViews[path]);
  // if it's not in the cache, see if there's a
  // .handlebars file that matches
  if(fs.existsSync(__dirname + '/views' + path + '.handlebars')) {
    autoViews[path] = path.replace(/^\//, '');
    return res.render(autoViews[path]);
  }
  // no view found; pass on to 404 handler
  next();
});

// twitter functionality

var topTweets = {
  count: 10,
  lastRefreshed: 0,
  refreshInterval: 15 * 60 * 1000,
  tweets: []
};

function getTopTweets(cb) {
  if(Date.now() < topTweets.lastRefreshed +
      topTweets.refreshInterval) {
    return cb(topTweets.tweets);
  }
  twitter.search('#meadowlark', topTweets.count, function(result) {
    var formattedTweets = [];
    var promises = [];
    var embedOpts = { omit_script: 1 };
    result.statuses.forEach(function(status) {
      var deferred = Q.defer();
      twitter.embed(status.id_str, embedOpts, function(embed) {
        formattedTweets.push(embed.html);
        deferred.resolve();
      });
      promises.push(deferred.promise);
    });
    Q.all(promises).then(function() {
      topTweets.lastRefreshed = Date.now();
      cb(topTweets.tweets = formattedTweets);
    });
  });
}

// Geocoding API

var dealerCache = {
  lastRefreshed: 0,
  refreshInterval: 60 * 60 * 1000,
  jsonUrl: '/dealers.json',
  geocodeLimit: 2000,
  geocodeCount: 0,
  geocodeBegin: 0
};

dealerCache.jsonFile = __dirname +
  '/public' + dealerCache.jsonUrl;

function geocodeDealer(dealer) {
  var addr = dealer.getAddress(' ');
  if (addr===dealer.geocodedAddress) {
    return;          // already geocoded
  }

  if (dealerCache.geocodeCount >= dealerCache.geocodeLimit) {
    // has 24 passed since we last started geocoding?
    if (Date.now() > dealerCache.geocodeCount + 24 * 60 * 60 * 1000) {
      dealerCache.geocodeBegin = Date.now();
      dealerCache.geocodeCount = 0;
    } else {
      // we can't geocode this now: we've
      // reached our usage limit
      return;
    }
  }

  var geocode = require('./lib/geocode.js');
  geocode(addr, function(err, coords) {
    if (err) {
      return console.log('Geocoding failute for ' + addr);
    }
    dealer.lat = coords.lat;
    dealer.lng = coords.lng;
    dealer.save();
  });

}

dealerCache.refresh = function(cb) {
  if(Date.now() > dealerCache.lastRefreshed + dealerCache.refreshInterval) {
    // we need to refresh the cache
    Dealer.find({ active: true }, function(err, dealers) {
      if (err) {
        return console.log('Error fetching dealers' + err);
      }

      // geocodeDealer will do nothing if coordinates are up-to-date
      dealers.forEach(geocodeDealer);

      // we now write all the dealers out to our cached JSON file
      fs.writeFileSync(dealerCache.jsonFile, JSON.stringify(dealers));

      // all done -- invoke callback
      cb();
    });
  }
};

function refreshDealerCacheForever() {
  dealerCache.refresh(function() {
    // call self after refresh interval
    setTimeout(refreshDealerCacheForever,
      dealerCache.refreshInterval);
  });
}

// create empty cache if it doesn't exist to prevent 404 errors
if(!fs.existsSync(dealerCache.jsonFile)) fs.writeFileSync(JSON.stringify([]));
// start refreshing cache
refreshDealerCacheForever();

// Website API configuration
var apiOptions = {
  context: '/api',
  domain: require('domain').create()
};

// link API into pipeline
app.use(rest.rester(apiOptions));

// Handle API routes
require('./api_routes.js')(rest);

// custom 404 page
app.use(function(req, res) {
  res.status(404);
  res.render('404');
});

// custom 500 page
app.use(function(err, req, res, next) {
  console.log(err.stack);
  res.status(500);
  res.render('500');
});

function startServer() {
  var options = {
    key: fs.readFileSync(__dirname + '/ssl/meadowlark.pem'),
    cert: fs.readFileSync(__dirname + '/ssl/meadowlark.crt'),
  };

  https.createServer(options, app).listen(app.get('port'), function() {
    console.log('Express started in ' + app.get('env') +
      'mode on https://localhost:' + app.get('port') +
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
