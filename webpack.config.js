const path = require('path');
const autoprefixer = require('autoprefixer');

module.exports = [{
    entry: ['./src/styles/app.scss', './src/lib/options.js'],
    output: {
      path: path.resolve(__dirname, 'build'),
      filename: 'options.js',
    },
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
