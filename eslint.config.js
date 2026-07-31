import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';
import prettierConfig from 'eslint-config-prettier';

/**
 * ESLint flat config.
 *
 * Beyond the usual strictness, this config enforces the architectural
 * boundaries of the repository:
 *
 * 1. `src/client` and `src/shared` MUST NOT import runtime code from
 *    `src/server`. The client may import *types* from the server
 *    (e.g. to type an API response), which is why `allowTypeImports`
 *    is enabled for the client zone only.
 * 2. `src/shared` MUST NOT import from `src/client` either — shared code
 *    has to stay usable from both sides.
 * 3. `zod` may only be imported inside `src/shared/validation`. Everything
 *    else must go through the validation facade so the underlying schema
 *    library can be swapped (e.g. to yup) without touching consumers.
 * 4. `apps/mobile` (the Expo app) is subject to the same rules as the web
 *    client — plus facades for the platform SDKs it wraps.
 */
export default tseslint.config(
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/coverage/**',
      'apps/mobile/.expo/**',
      'apps/mobile/android/**',
      'apps/mobile/ios/**',
      // Bixby capsule: a separate project with its own runtime (Bixby's JS
      // sandbox, `$vivContext`, its own `require` resolution). It is built by
      // Bixby Developer Studio, not by this repo's toolchain.
      'capsule/**',
      'apps/mobile/expo-env.d.ts',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  ...tseslint.configs.stylisticTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      '@typescript-eslint/consistent-type-imports': ['error', { prefer: 'type-imports' }],
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      // `await` on non-promises is usually a bug, and floating promises hide failures.
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/no-misused-promises': ['error', { checksVoidReturn: false }],
    },
  },
  // React hooks rules for the client and the mobile app.
  {
    files: ['src/client/**/*.{ts,tsx}', 'apps/mobile/**/*.{ts,tsx}'],
    plugins: { 'react-hooks': reactHooks },
    rules: reactHooks.configs.recommended.rules,
  },
  // Boundary: client may not import server runtime code (types are allowed).
  {
    files: ['src/client/**/*.{ts,tsx}'],
    rules: {
      '@typescript-eslint/no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['@server/*', '**/server/**'],
              allowTypeImports: true,
              message:
                'The client must not import server runtime code. Move shared code to src/shared. (Type-only imports are allowed.)',
            },
          ],
        },
      ],
    },
  },
  // Boundary: the mobile app may not import server runtime code either
  // (types are allowed, exactly like the web client).
  {
    files: ['apps/mobile/**/*.{ts,tsx}'],
    rules: {
      '@typescript-eslint/no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['@server/*', '**/src/server/**', '@client/*', '**/src/client/**'],
              allowTypeImports: true,
              message:
                'The mobile app must not import server or web-client code. Move shared code to src/shared. (Type-only imports of server types are allowed.)',
            },
          ],
        },
      ],
    },
  },
  // Boundary: shared may not import from client nor server at all.
  // (Tests are exempt from the platform-purity part — they run under
  // `bun test`; production sources stay pure so Metro/Hermes can consume them.)
  {
    files: ['src/shared/**/*.{ts,tsx}'],
    ignores: ['src/shared/**/*.test.{ts,tsx}'],
    rules: {
      '@typescript-eslint/no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: [
                '@server/*',
                '**/server/**',
                '@client/*',
                '**/client/**',
                '**/apps/mobile/**',
                // Shared code now also runs on Metro/Hermes — no platform deps.
                'react-native',
                'react-native/*',
                'expo',
                'expo-*',
                'bun',
                'bun:*',
                'node:*',
              ],
              allowTypeImports: false,
              message:
                'Shared code must stay portable TypeScript: no server/client/app modules and no platform (Node/Bun/React Native) dependencies — both Bun and Metro consume these sources.',
            },
          ],
        },
      ],
    },
  },
  // Shared TEST files may use bun:test but still must not depend on app code.
  {
    files: ['src/shared/**/*.test.{ts,tsx}'],
    rules: {
      '@typescript-eslint/no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['@server/*', '**/server/**', '@client/*', '**/client/**', '**/apps/**'],
              allowTypeImports: false,
              message:
                'Shared code (tests included) must not depend on server, client or app code.',
            },
          ],
        },
      ],
    },
  },
  // Facade: zod is an implementation detail of src/shared/validation.
  {
    files: ['src/**/*.{ts,tsx}', 'scripts/**/*.ts', 'apps/**/*.{ts,tsx}'],
    ignores: ['src/shared/validation/**'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: 'zod',
              message:
                'Import from @shared/validation instead. zod is an implementation detail behind the validation facade.',
            },
            {
              name: 'zod/mini',
              message:
                'Import from @shared/validation instead. zod is an implementation detail behind the validation facade.',
            },
          ],
        },
      ],
    },
  },
  // Facades: platform SDKs may only be touched by their facade module, so a
  // swap (e.g. MMKV instead of AsyncStorage) stays a one-file change.
  {
    files: ['apps/mobile/**/*.{ts,tsx}'],
    ignores: ['apps/mobile/src/storage/**', 'apps/mobile/src/version/updates.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: 'expo-secure-store',
              message: 'Use the secure storage facade in src/storage/secure-store.ts instead.',
            },
            {
              name: 'expo-updates',
              message: 'Use the update channel facade in src/version/updates.ts instead.',
            },
            {
              name: '@react-native-async-storage/async-storage',
              message: 'Use the key-value storage facade in src/storage/kv-store.ts instead.',
            },
            {
              name: 'zod',
              message: 'Import from @shared/validation instead.',
            },
            {
              name: 'zod/mini',
              message: 'Import from @shared/validation instead.',
            },
          ],
        },
      ],
    },
  },
  // bun:test's `expect(...).rejects` matchers must be awaited at runtime but
  // are typed as non-thenable — keep the awaits, silence the false positive.
  {
    files: ['**/*.test.{ts,tsx}'],
    rules: {
      '@typescript-eslint/await-thenable': 'off',
    },
  },
  // Config files are not part of the typed project service.
  {
    files: ['eslint.config.js', '**/babel.config.js', '**/metro.config.js'],
    extends: [tseslint.configs.disableTypeChecked],
  },
  {
    files: ['**/babel.config.js', '**/metro.config.js'],
    languageOptions: {
      sourceType: 'commonjs',
      globals: { module: 'writable', require: 'readonly', __dirname: 'readonly' },
    },
    rules: {
      '@typescript-eslint/no-require-imports': 'off',
    },
  },
  prettierConfig,
);
