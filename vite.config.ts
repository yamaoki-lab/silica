import { readFileSync } from 'node:fs'
import { defineConfig } from 'vite'

// peerDependencies は使う側が持つので, 包みに入れない.
const { peerDependencies = {} }: { peerDependencies?: Record<string, string> } = JSON.parse(
  readFileSync(new URL('./package.json', import.meta.url), 'utf8'),
)
const peers = Object.keys(peerDependencies)

// https://vite.dev/config/
export default defineConfig({
  build: {
    target: 'esnext',
    // 使う側の組み立てで縮めるので, ここでは読める形のまま出す.
    minify: false,
    lib: {
      entry: {
        index: 'src/index.ts',
        'apps/index': 'src/apps/index.ts',
      },
      formats: ['es'],
    },
    rolldownOptions: {
      // モジュールごとのファイルで出すと, 使う側の組み立てが要らないファイルを落とし, ファイルの境目で分けられる.
      output: { preserveModules: true, preserveModulesRoot: 'src' },
      external: (id) => peers.some((name) => id === name || id.startsWith(`${name}/`)),
    },
  },
})
