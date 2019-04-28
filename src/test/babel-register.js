require('@babel/register')({
    presets: [
        ["@babel/preset-env", {targets: {node: true}}]
    ],
    exclude: [],
    ignore: [/\/node_modules\/(?!@material\/)/],
    sourceMaps: 'inline',
    retainLines: true
});