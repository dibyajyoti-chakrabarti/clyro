import js from '@eslint/js'
import globals from 'globals'
import react from 'eslint-plugin-react'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist']),
  {
    // Playwright's config and specs run under Node, not in the browser, so
    // globals.browser alone left `process` undefined and every one of them
    // failed no-undef. `npm run lint` is `eslint .`, so that was enough on its
    // own to keep the lint job red however clean src/ was.
    files: ['e2e/**/*.js', 'playwright.config.js'],
    languageOptions: { globals: globals.node },
  },
  {
    files: ['**/*.{js,jsx}'],
    extends: [
      js.configs.recommended,
      reactHooks.configs['recommended-latest'],
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
      parserOptions: {
        ecmaVersion: 'latest',
        ecmaFeatures: { jsx: true },
        sourceType: 'module',
      },
    },
    plugins: { react },
    rules: {
      // The rule that teaches no-unused-vars an identifier referenced as
      // <Thing /> counts as used. Without it every component reached only
      // through JSX read as dead. varsIgnorePattern below was the workaround,
      // and it covers variables but not destructured props, so a component
      // taking `{ Icon }` and rendering `<Icon />` errored anyway. Sixteen
      // files did, and the lint job was red on main because of it.
      'react/jsx-uses-vars': 'error',
      'no-unused-vars': 'error',
    },
  },
])
