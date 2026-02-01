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
  base: '/',
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
