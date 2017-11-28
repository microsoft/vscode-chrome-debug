const path = require('path');

module.exports = {
  entry: './src/script.js',
  devtool: 'source-map',
  output: {
    filename: 'bundle.js',
    path: path.resolve(__dirname, 'dist')
  }
};