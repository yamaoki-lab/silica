// セッションの wasm を組み立て, 縮めて, ラッパーが読む場所に置く (pnpm build:wasm).
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const built = 'target/wasm32-unknown-unknown/wasm/silica_session.wasm';
const out = 'src/session/session.wasm';

execFileSync(
  'cargo',
  ['build', '--target', 'wasm32-unknown-unknown', '--profile', 'wasm', '-p', 'silica-session'],
  { cwd: root, stdio: 'inherit' },
);

// wasm-opt は pnpm で入れたもの (binaryen) を使い, 手元と CI で同じバージョンにする.
// .cmd を介さず node で直に動かすので, OS によらない.
const wasmOpt = createRequire(import.meta.url).resolve('binaryen/bin/wasm-opt');
execFileSync(
  process.execPath,
  [
    wasmOpt,
    built,
    '-o',
    out,
    '-Oz',
    // 使う機能は rustc が書いた節から読み, 縮めた後にその節と名前等の節を消す.
    '--strip-debug',
    '--strip-producers',
    '--strip-target-features',
  ],
  { cwd: root, stdio: 'inherit' },
);
