module.exports = {
    root: true,
    env: {
        browser: true,
        node: true,
    },
    parser: '@typescript-eslint/parser',
    plugins: [
        '@typescript-eslint',
        '@stylistic/js',
        '@stylistic/ts',
    ],
    extends: [
        'eslint:recommended',
        'plugin:@typescript-eslint/recommended',
    ],
    rules: {
        'semi': ['error', 'always'],
        '@stylistic/js/arrow-parens': ['error', 'always'],
        '@stylistic/ts/comma-dangle': ['error', 'always-multiline'],
        '@stylistic/ts/comma-spacing': ['error'],
        '@stylistic/ts/indent': ['error', 4],
        '@stylistic/ts/key-spacing': ['error'],
        '@stylistic/ts/quotes': ['error', 'single'],
        '@typescript-eslint/ban-types': 'off',
        '@typescript-eslint/no-explicit-any': 'error',
        '@typescript-eslint/no-empty-function': 'off',
        '@typescript-eslint/no-var-requires': 'off',
    },
    overrides: [{
        files: ['*.test.ts'],
        rules: {
            '@typescript-eslint/no-explicit-any': 'off',
            '@typescript-eslint/no-unused-vars': ['error', {args: 'none'}],
            '@typescript-eslint/no-non-null-assertion': 'off',
        },
    }],
};