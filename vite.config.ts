import { defineConfig, loadEnv, type Plugin } from 'vite'
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

// Server-backed builds omit the browser backend before Vite emits its assets.
// The static demo needs that backend even though it is a production build.
const stubDevOnlyModules = (): Plugin => {
  let demo = false
  const DEV_ONLY = ['/src/api/router.ts', '/src/db/index.ts']

  return {
    name: 'tekne:stub-dev-only-modules',
    enforce: 'pre',
    apply: (_config, { mode }) => mode === 'production',
    configResolved(config) {
      demo = !!loadEnv(config.mode, config.envDir, 'TEKNE_').TEKNE_DEMO
    },
    load(id) {
      const stub =
        id.endsWith('/src/dev/PgliteDevtools.tsx') ||
        (!demo && DEV_ONLY.some((path) => id.endsWith(path)))
      return stub ? 'export {}\n' : null
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
          setupFiles: ['./src/test-setup.ts'],
          globals: true,
          exclude: [
            ...configDefaults.exclude,
            '**/*.browser.test.*',
            // Agent worktrees and the pnpm store carry copies of the repo
            '.claude/**',
            '.pnpm-store/**',
          ],
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
            // Desktop-size viewport: the default 414px is below the md
            // breakpoint, where the gutter under test is hidden entirely.
            instances: [
              { browser: 'chromium', viewport: { width: 1280, height: 800 } },
            ],
          },
        },
      },
    ],
  },
})
