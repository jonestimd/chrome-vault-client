const [config] = require('./webpack.config');

module.exports = [{
    ...config,
    mode: 'development',
    optimization: {
        minimize: false,
    },
    devtool: 'inline-source-map',
}];