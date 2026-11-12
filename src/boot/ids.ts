// 起動画面をページの中で探すための id. silica/vite が index.html に差し込み, mount が消す (#13).
// silica/vite はビルドの時に Node で動き, mount はページで動くので, どちらからも読めるようここに置く.

// 起動画面. index.html の中だけで定義し, JS を待たずに出す.
export const bootElementId = 'silica-boot';
