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
    output: {
        filename: 'out/bundle.js'
    },
    resolve: {
        // Add '.ts' and '.tsx' as a resolvable extension.
        extensions: ['', '.webpack.js', '.web.js', '.ts', '.tsx', '.js']
    },
    module: {
        loaders: [
            // all files with a '.ts' or '.tsx' extension will be handled by 'ts-loader'
            { test: /\.tsx?$/, loader: 'ts-loader' }
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
    },
    libraryTarget: 'commonjs',
    library: 'library'
};
