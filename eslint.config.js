import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import react from 'eslint-plugin-react'

export default tseslint.config(
  // src/documentation/generated is MDX compiler output (see scripts/build-docs.js)
  { ignores: ['dist', 'docs-build/**', 'src/documentation/generated/**'] },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
      parserOptions: {
        ecmaFeatures: {
          jsx: true,
        },
      },
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
      react,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': [
        'warn',
        { allowConstantExport: true },
      ],
      'react/react-in-jsx-scope': 'off',
      'react/jsx-uses-react': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unused-vars': 'warn',
      'no-empty': 'warn',
      'prefer-const': 'warn',
      'react-hooks/exhaustive-deps': 'warn',
    },
  },
  {
    // The component kit lives behind src/components/vendor; everything else
    // imports the wrappers so the kit can be swapped at one seam.
    files: ['src/**/*.{ts,tsx}'],
    ignores: ['src/components/vendor/**'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['@headlessui/react', '@radix-ui/*'],
              message:
                'Import UI primitives from @/components/vendor, not the kit directly.',
            },
            {
              group: ['@heroicons/*'],
              message: 'Use lucide-react icons (see components.json).',
            },
          ],
        },
      ],
    },
    settings: {
      react: {
        version: 'detect',
      },
    },
  }
)
