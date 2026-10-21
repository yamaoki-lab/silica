// セッションの wasm をビルドし, 縮めて, ラッパーが読む場所に置く (pnpm build:wasm).
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url)).replace(/[\\/]$/, '');
const built = 'target/wasm32-unknown-unknown/wasm/silica_session.wasm';
const out = 'src/session/session.wasm';

// panic の場所の文字列に, ビルドした所の絶対パス (ホームディレクトリ等) が入る.
// 配る wasm に手元のパスを残さず, 手元と CI で同じ wasm になるように, パスの頭を置き換える.
const cargoHome = process.env.CARGO_HOME ?? join(homedir(), '.cargo');
const remaps = [`${root}=.`, `${join(cargoHome, 'registry', 'src')}=cargo`];
const rustflags = remaps.map((remap) => `--remap-path-prefix=${remap}`);

execFileSync(
  'cargo',
  [
    'build',
    '--target',
    'wasm32-unknown-unknown',
    '--profile',
    'wasm',
    '-p',
    'silica-session',
    '--config',
    `target.wasm32-unknown-unknown.rustflags = ${JSON.stringify(rustflags)}`,
  ],
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
