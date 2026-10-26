import react from '@vitejs/plugin-react'
import silica from 'silica/vite'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  // silica() は S2 の style マクロ, ビルドの target, S2 の CSS のまとめ方等を入れる.
  plugins: [silica(), react()],
  server: {
    // 同じネットワークの他の端末からも見られるよう, 全てのアドレスで待ち受ける.
    host: true,
  },
})
