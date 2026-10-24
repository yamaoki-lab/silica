// 配るセッションの wasm の場所と, 展開した後の大きさ. mount が loadSession に渡す.
// loadSession とは別のファイルにし, index.ts からも出さない. 自分の URL を渡す使い方では, この wasm を使う側の出力に入れない.

// 使う側のバンドラは, この形を見て wasm をハッシュ付きの別のファイルとして出す.
// ?no-inline は, 使う側が資産を埋める上限 (assetsInlineLimit) を上げても, wasm を JS に埋めないため.
// 埋めると大きくなり, 取得の進捗もキャッシュも JS と分けられない.
export const sessionWasmUrl = new URL('./session.wasm?no-inline', import.meta.url);

// silica() が define で埋める. 無い時 (silica() を使わない, テスト) は,
// loadSession は圧縮していない時の Content-Length から取る.
declare const __SILICA_SESSION_WASM_SIZE__: number | undefined;
export const sessionWasmSize: number | undefined =
  typeof __SILICA_SESSION_WASM_SIZE__ === 'number' ? __SILICA_SESSION_WASM_SIZE__ : undefined;
