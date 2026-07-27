import { defineConfig } from 'vite'
import viteReact from '@vitejs/plugin-react'
import { TanStackRouterVite } from '@tanstack/router-plugin/vite'
import tailwindcss from '@tailwindcss/vite'
import { resolve } from 'node:path'
import { execSync } from 'node:child_process'

function getGitInfo() {
  try {
    const hash = process.env.GIT_HASH || process.env.VERCEL_GIT_COMMIT_SHA || execSync('git rev-parse HEAD', { encoding: 'utf8' }).trim()
    const message = process.env.GIT_MESSAGE || process.env.VERCEL_GIT_COMMIT_MESSAGE || execSync('git log -1 --pretty=%B', { encoding: 'utf8' }).trim()
    return { hash, message }
  } catch {
    return { hash: 'unknown', message: 'unknown' }
  }
}

// https://vitejs.dev/config/
export default defineConfig({
  base: process.env.TEKNE_BASE_PATH || '/',
  plugins: [
    TanStackRouterVite({ autoCodeSplitting: true }),
    viteReact(),
    tailwindcss(),
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
    environment: 'jsdom',
    setupFiles: [],
    globals: true,
  },
})
