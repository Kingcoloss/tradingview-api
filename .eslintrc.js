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
    'import/core-modules': ['bun:test'],
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
  ],
};
