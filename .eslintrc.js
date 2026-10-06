module.exports = {
  env: {
    commonjs: true,
    es2021: true,
    node: true,
  },
  globals: {
    WebSocket: 'readonly',
  },
  ignorePatterns: ['dist/'],
  settings: {
    'import/core-modules': ['bun', 'bun:test', '@mathieuc/tradingview'],
    'import/resolver': {
      node: { extensions: ['.js', '.ts'] },
    },
  },
  extends: [
    'airbnb-base',
  ],
  parser: '@babel/eslint-parser',
  parserOptions: {
    ecmaVersion: 12,
    requireConfigFile: false,
  },
  rules: {
    'no-console': 'off',
    'import/no-extraneous-dependencies': [
      'error',
      {
        devDependencies: ['./test.js', './tests/**'],
      },
    ],
    'no-restricted-syntax': 'off',
    'no-await-in-loop': 'off',
    'no-continue': 'off',
    'guard-for-in': 'off',
    'import/extensions': ['error', 'ignorePackages', { js: 'never', ts: 'never' }],
  },
  overrides: [
    {
      files: ['**/*.ts'],
      parser: '@typescript-eslint/parser',
      parserOptions: { ecmaVersion: 12, sourceType: 'module' },
      plugins: ['@typescript-eslint'],
      rules: {
        'no-unused-vars': 'off',
        '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
        'import/extensions': ['error', 'ignorePackages', { js: 'never', ts: 'never' }],
        'import/no-duplicates': 'off',
      },
    },
    {
      files: ['tests/**/*.ts'],
      rules: {
        'eol-last': 'off',
      },
    },
    {
      files: ['scripts/build-node.mjs', 'scripts/build-bun.mjs', 'tests/pack/pack.test.ts'],
      globals: { Bun: 'readonly', Response: 'readonly' },
    },
    {
      files: ['tests/types/**/*.ts', 'tests/types/**/*.js'],
      rules: {
        'import/no-unresolved': 'off',
        'no-void': 'off',
      },
    },
  ],
};
