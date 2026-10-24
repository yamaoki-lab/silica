import { readFileSync, statSync } from 'node:fs'
import { defineConfig } from 'vite'

// peerDependencies は使う側が持つので, 包みに入れない.
const { peerDependencies = {} }: { peerDependencies?: Record<string, string> } = JSON.parse(
  readFileSync(new URL('./package.json', import.meta.url), 'utf8'),
)
const peers = Object.keys(peerDependencies)

// 展開した後の wasm の大きさ. 読み込みの進捗の割合に使う (src/session/wasm.ts). 先に pnpm build:wasm を済ませておく.
const sessionWasmSize = statSync(new URL('./src/session/session.wasm', import.meta.url)).size

// https://vite.dev/config/
export default defineConfig({
  // wasm 等の資産を, 置いた場所からの相対の URL で指す. 既定の '/' では使う側のページの根を指してしまう.
  base: './',
  define: {
    __SILICA_SESSION_WASM_SIZE__: JSON.stringify(sessionWasmSize),
  },
  build: {
    target: 'esnext',
    // 使う側のビルドで縮めるので, ここでは読める形のまま出す.
    minify: false,
    lib: {
      entry: {
        index: 'src/index.ts',
        'apps/index': 'src/apps/index.ts',
        // mount ができるまでは他から辿れないので, wasm を dist に出すためにエントリにする. exports には足さない.
        'session/wasm': 'src/session/wasm.ts',
      },
      formats: ['es'],
    },
    rolldownOptions: {
      // モジュールごとのファイルで出すと, 使う側のビルドが要らないファイルを落とし, ファイルの境目で分けられる.
      output: {
        preserveModules: true,
        preserveModulesRoot: 'src',
        // 資産もソースと同じ場所に置く (src/session/session.wasm は dist/session/session.wasm).
        assetFileNames: ({ originalFileNames }) =>
          originalFileNames[0]?.replace(/^src\//, '') ?? '[name][extname]',
      },
      external: (id) => peers.some((name) => id === name || id.startsWith(`${name}/`)),
    },
  },
})
