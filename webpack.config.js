const webpack = require('webpack');
const path = require('path');
const fs = require('fs');
const glob = require('glob');

const nodeModules = {};
fs.readdirSync('node_modules')
  .filter(f => !f.startsWith('bin'))
  .forEach(mod => {
    nodeModules[mod] = 'commonjs ' + mod;
  });

module.exports = {
    entry: {
        src: './src/chromeDebug.ts'
    },
    devtool: 'source-map',
    resolve: {
        extensions: ['.ts']
    },
    output: {
        filename: 'out/bundle.js'
    },
    module: {
        rules: [
            { test: /\.ts$/, exclude: /node_modules/, loader: 'ts-loader' },
        ]
    },
    externals: nodeModules,
    plugins: [
        require('webpack-fail-plugin'),
        new webpack.DefinePlugin({
            VERSION: `"${require('./package.json').version}"`,
            ROOT_DIR: `"${__dirname}"`
         })
    ],
    target: 'node',
    node: {
        __dirname: false
    }
};
