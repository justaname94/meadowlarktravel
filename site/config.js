module.exports = {
  bundles: {
    clientJavaScript: {
      main: {
        file: '/js/meadowlark.min.4f586059.js',
        location: 'head',
        contents: [
          '/js/contact.js',
          '/js/cart.js'
        ]
      }
    },

    clientCss: {
      main: {
        file: '/css/meadowlark.min.8c1e946e.css',
        contents: [
          '/css/main.css',
          '/css/cart.css'
        ]
      }
    }
  }
};