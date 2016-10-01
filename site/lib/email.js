var nodemailer = require('nodemailer');
var smtpTransport = require('nodemailer-smtp-transport');

module.exports = function(credentials) {
  var mailTransport = nodemailer.createTransport(smtpTransport({
    host: 'smtp.gmail.com',
    secureConnection: false,
    port: 587,
    auth: {
      user: credentials.gmail.user,
      pass: credentials.gmail.password
    }
  }));

  var from = '"Meadowlarktravel" <info@meadowlarkTravel.com>';
  var errorRecipient = 'roniel_valdez@outlook.com';

  return {
    send: function(to, subj, body) {
      mailTransport.sendMail({
        from: from,
        to: to,
        subject: subj,
        html: body,
        generateTextFromHtml: true
      }, function(err) {
        if (err) {
          console.error('Unable to sned email: ' + err);
        }
      });
    },

    emailError: function(message, filename, exception) {
      var body = '<h1>Meadowlark Travel site Error</h1>' +
          'message:<br><pre>' + message + '</pre><br>';
      if (exception) {
        body += 'exception: <br><pre>' + exception +
            '</pre><br>';
      }
      if (filename) {
        body += 'filename: <br><pre>' + filename +
            '</pre><br>';
      }
      mailTransport.sendEmail({
        from: from,
        to: errorRecipient,
        subject: 'Meadowlark Travel Site Error',
        html: body,
        generateTextFromHtml: true
      }, function(err) {
        if (err) {
          console.error('Unable to send emai: ' + err);
        }
      });
    }
  };
};

// mailTransport.sendMail({
//   from: '"MeadowLark Travel" <cvbot2@gmail.com>',
//   to: 'cvbot2@gmail.com, roniel_valdez@outlook.com',
//   subject: 'Your Meadowlark Travel Tour',
//   html: '<h1>Meadowlark Travel</h1>\n<p>Thanks for book your trip with' +
//           ' MeadowLark Travel. <b>We look forward to your visit</b></p>' +
//           '<img src="//meadowlarktravel.com/email.logo.png">',
//   text: 'Thank you for booking your trip with Meadowlark Travel. ' +
//           'We look forward to your visit!'
// }, function(error, info) {
//   if (error) {
//     console.error('Unable to send email: ' + error);
//   }
//   console.log('Message sent ' + info.response);
// });