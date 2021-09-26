const [config] = require('./webpack.config');

module.exports = [{
    ...config,
    optimization: {
        minimize: false,
    },
    devtool: 'inline-source-map',
}];