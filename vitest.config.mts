import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tsconfigPaths from 'vite-tsconfig-paths'

const sharedPlugins = [tsconfigPaths(), react()]

export default defineConfig({
  plugins: sharedPlugins,
  test: {
    projects: [
      {
        plugins: sharedPlugins,
        test: {
          name: 'node',
          include: ['src/lib/__tests__/**'],
          environment: 'node',
        },
      },
      {
        plugins: sharedPlugins,
        test: {
          name: 'jsdom',
          exclude: ['src/lib/__tests__/**'],
          environment: 'jsdom',
        },
      },
    ],
  },
})
