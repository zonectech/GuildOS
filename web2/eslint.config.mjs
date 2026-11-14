// Lint runs before every build (see "build" in package.json) and a violation stops the build.
// Only React's rules of hooks are checked: a hook below an early return crashes the page once data
// loads, and a missing effect dependency shows stale data. Both are easy to miss in review.
import tsParser from '@typescript-eslint/parser';
import reactHooks from 'eslint-plugin-react-hooks';

export default [
  // Build output (.next, and the .next-* folders other builds use), dependencies and generated files.
  { ignores: ['.next*/**', 'node_modules/**', 'next-env.d.ts', 'out/**', 'public/**'] },
  {
    files: ['**/*.{ts,tsx,js,jsx,mjs}'],
    languageOptions: { parser: tsParser, parserOptions: { ecmaFeatures: { jsx: true } } },
    plugins: { 'react-hooks': reactHooks },
    // Comments elsewhere may name rules this config doesn't load; don't report those.
    linterOptions: { reportUnusedDisableDirectives: 'off' },
    rules: {
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'error',
    },
  },
];
