import react from '@vitejs/plugin-react'
import macros from 'unplugin-parcel-macros'
import { defaultClientConditions, defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  // S2 の style マクロを組み立て時に CSS へ直すため, macros は最初に置く.
  plugins: [macros.vite(), react()],
  resolve: {
    // silica の package.json の silica-source の条件で, dist を作らずにソースを読む.
    conditions: ['silica-source', ...defaultClientConditions],
  },
  server: {
    // 同じネットワークの他の端末からも見られるよう, 全てのアドレスで待ち受ける.
    host: true,
  },
  build: {
    target: 'esnext',
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: [
            // S2 の CSS は部品の間で重なりが多いので, 分けずに1つにまとめた方が小さくなる.
            { name: 's2-styles', test: /macro-(.*)\.css$|@react-spectrum\/s2\/.*\.css$/ },
          ],
        },
      },
    },
  },
})
