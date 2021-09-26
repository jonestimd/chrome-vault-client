const path = require('path');

module.exports = [{
    entry: {
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
