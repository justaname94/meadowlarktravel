module.exports = {
  bundles: {
    clientJavaScript: {
      main: {
        file: '/js/meadowlark.min.8ee96970.js',
        location: 'head',
        contents: [
          '/js/contact.js',
          '/js/cart.js'
        ]
      }
    },

    clientCss: {
      main: {
        file: '/css/meadowlark.min.2a8883cf.css',
        contents: [
          '/css/main.css',
          '/css/cart.css'
        ]
      }
    }
  }
};