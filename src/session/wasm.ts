// 配るセッションの wasm の場所と, 展開した後の大きさ. mount が loadSession に渡す.
// loadSession とは別のファイルにし, index.ts からも出さない. 自分の URL を渡す使い方では, この wasm を使う側の出力に入れない.

// 使う側のバンドラは, この形を見て wasm をハッシュ付きの別のファイルとして出す.
// ?no-inline は, silica 自身のライブラリのビルドで wasm を JS に埋めないため (build.lib は資産を必ず埋める).
export const sessionWasmUrl = new URL('./session.wasm?no-inline', import.meta.url);

// silica のビルドで, vite.config の define が埋める. ソースのまま読む時 (開発サーバ, テスト) は無く,
// loadSession は圧縮していない時の Content-Length から取る.
declare const __SILICA_SESSION_WASM_SIZE__: number | undefined;
export const sessionWasmSize: number | undefined =
  typeof __SILICA_SESSION_WASM_SIZE__ === 'number' ? __SILICA_SESSION_WASM_SIZE__ : undefined;
