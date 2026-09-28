import react from '@vitejs/plugin-react'
import { defaultClientConditions, defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    // silica の package.json の silica-source の条件で, dist を作らずにソースを読む.
    conditions: ['silica-source', ...defaultClientConditions],
  },
  build: {
    target: 'esnext',
  },
})
