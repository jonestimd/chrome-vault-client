const path = require('path');
const autoprefixer = require('autoprefixer');

module.exports = [{
    entry: {
      styles: './src/styles/app.scss',
      options: './src/lib/options.js',
      popup: './src/lib/popup.js',
      contentScript: './src/lib/contentScript.js',
      background: './src/lib/background.js'
    },
    output: {
      path: path.resolve(__dirname, 'build'),
      filename: '[name].js'
    },
    devtool: 'source-map',
    module: {
      rules: [
        {
          test: /\.scss$/,
          use: [
            { loader: 'file-loader', options: {name: 'bundle.css'} },
            { loader: 'extract-loader' },
            { loader: 'css-loader' },
            { loader: 'postcss-loader', options: {plugins: () => [autoprefixer()]} },
            { loader: 'sass-loader', options: {includePaths: ['./node_modules']} },
          ]
        },
        {
          test: /\.js$/,
          loader: 'babel-loader',
          query: {presets: ['es2015']}
        }
      ]
    },
  }];
