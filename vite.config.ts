import { defineConfig, type Plugin } from 'vite'
import { configDefaults } from 'vitest/config'
import viteReact from '@vitejs/plugin-react'
import { TanStackRouterVite } from '@tanstack/router-plugin/vite'
import tailwindcss from '@tailwindcss/vite'
import { resolve } from 'node:path'
import { execSync } from 'node:child_process'

function getGitInfo() {
  try {
    const hash =
      process.env.GIT_HASH ||
      process.env.VERCEL_GIT_COMMIT_SHA ||
      execSync('git rev-parse HEAD', { encoding: 'utf8' }).trim()
    const message =
      process.env.GIT_MESSAGE ||
      process.env.VERCEL_GIT_COMMIT_MESSAGE ||
      execSync('git log -1 --pretty=%B', { encoding: 'utf8' }).trim()
    return { hash, message }
  } catch {
    return { hash: 'unknown', message: 'unknown' }
  }
}

/**
 * Keeps the development-only backend out of production builds.
 *
 * The in-memory mode runs the tRPC router in the browser against PGlite, and
 * both places that reach for it import it dynamically behind an
 * `import.meta.env.PROD` check. Rollup does drop those branches — but only
 * after loading the modules, by which point Vite has already emitted PGlite's
 * ~14MB of wasm and data into dist/assets as orphans nothing ever fetches.
 * Resolving the imports to an empty stub keeps them out of the module graph in
 * the first place.
 *
 * Stubbing happens at load rather than resolve so it survives Vite's alias
 * plugin, and the stub can be empty because the only production-reachable
 * imports of these modules are `import type`, which is erased before Rollup
 * sees it. The `import.meta.env.PROD` guards are still what stops the runtime
 * from reaching an empty module.
 *
 * Scoped to production mode, the same condition the branches are compiled out
 * under, so the dev server is untouched.
 */
const stubDevOnlyModules = (): Plugin => {
  const DEV_ONLY = [
    '/src/trpc/router.ts',
    '/src/db/index.ts',
    '/src/dev/PgliteDevtools.tsx',
  ]

  return {
    name: 'tekne:stub-dev-only-modules',
    enforce: 'pre',
    apply: (_config, { mode }) => mode === 'production',
    load(id) {
      return DEV_ONLY.some((path) => id.endsWith(path)) ? 'export {}\n' : null
    },
  }
}

// https://vitejs.dev/config/
export default defineConfig({
  base: process.env.TEKNE_BASE_PATH || '/',
  plugins: [
    TanStackRouterVite({ autoCodeSplitting: true }),
    viteReact(),
    tailwindcss(),
    stubDevOnlyModules(),
  ],
  define: {
    TEKNE_GIT_INFO: JSON.stringify(getGitInfo()),
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
    },
  },
  envPrefix: ['VITE_', 'TEKNE_'],
  server: {
    // Fail loudly instead of drifting to 3001: the dev deployment is reverse
    // proxied to a fixed port, so a silent fallback just yields 502s.
    strictPort: true,
    watch: {
      ignored: ['**/.pnpm-store/**'],
    },
  },
  optimizeDeps: {
    exclude: ['@electric-sql/pglite'],
  },
  test: {
    projects: [
      {
        extends: true,
        test: {
          name: 'unit',
          environment: 'jsdom',
          setupFiles: [],
          globals: true,
          exclude: [...configDefaults.exclude, '**/*.browser.test.*'],
        },
      },
      {
        // Real-browser tests for things jsdom cannot do, chiefly layout
        // geometry. Named *.browser.test.tsx, still next to their subject.
        extends: true,
        test: {
          name: 'browser',
          globals: true,
          include: ['src/**/*.browser.test.{ts,tsx}'],
          browser: {
            enabled: true,
            provider: 'playwright',
            headless: true,
            screenshotFailures: false,
            instances: [{ browser: 'chromium' }],
          },
        },
      },
    ],
  },
})
