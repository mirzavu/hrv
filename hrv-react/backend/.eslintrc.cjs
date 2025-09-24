module.exports = {
  root: true,
  env: { 
    node: true, 
    es2020: true,
    commonjs: true
  },
  extends: [
    'eslint:recommended',
  ],
  ignorePatterns: ['node_modules/', 'dist/'],
  parserOptions: { 
    ecmaVersion: 'latest', 
    sourceType: 'module' 
  },
  rules: {
    'no-console': 'off',
    'no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    'prefer-const': 'error',
    'no-var': 'error'
  },
} 