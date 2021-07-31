const path = require('path');
const autoprefixer = require('autoprefixer');

module.exports = [{
    entry: {
      styles: './src/styles/app.scss',
      options: './src/lib/options.ts',
      popup: './src/lib/popup.ts',
      contentScript: './src/lib/contentScript.ts',
      'chrome-background': './src/lib/chrome/background.ts',
      'firefox-background': './src/lib/firefox/background.ts',
    },
    output: {
      path: path.resolve(__dirname, 'build'),
      filename: '[name].js',
    },
    devtool: false,
    module: {
      rules: [
        {
          test: /\.scss$/,
          use: [
            { loader: 'file-loader', options: {name: 'bundle.css'} },
            { loader: 'extract-loader' },
            { loader: 'css-loader' },
            { loader: 'postcss-loader', options: {postcssOptions: {plugins: () => [autoprefixer()]}} },
            { loader: 'sass-loader', options: {sassOptions: {includePaths: ['./node_modules']}} },
          ],
        },
        {
          test: /\.ts$/,
          loader: 'ts-loader',
          exclude: /node_modules/,
        },
      ],
    },
    resolve: {
      extensions: [".ts", ".js"],
    },
  }];
