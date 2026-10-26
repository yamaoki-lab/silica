// サブパス silica/vite から出す, 使う側の Vite の設定に足すプラグイン. `plugins: [silica(), react()]` と書く.
// 使う側のビルドの時に Node が直に読むので, ここだけは JS にビルドして配る (pnpm build:vite).
// Node は node_modules の中の .ts の型を取り除かず, Vite の既定の設定の読み方ではそこで止まるため.
import { statSync } from 'node:fs';
import type { Plugin, UserConfig } from 'vite';
import { silicaMacros } from './macros.ts';

// S2 の CSS はコンポーネントの間で重なりが多いので, 分けずに1つにまとめた方が小さくなる.
const s2Styles = {
  name: 's2-styles',
  test: /macro-(.*)\.css$|@react-spectrum[\\/]s2[\\/].*\.css$/,
};

export default function silica(): Plugin[] {
  return [...silicaMacros(), silicaConfig()];
}

// 使う側の設定に混ぜる値. 使う側が指定しているものは, そちらを優先する.
function silicaConfig(): Plugin {
  return {
    name: 'silica:config',
    config(config) {
      const build: NonNullable<UserConfig['build']> = {};
      if (config.build?.target === undefined) build.target = 'esnext';
      if (canAddGroup(config)) {
        // Vite は配列を使う側の後ろに繋ぐ. 同じ優先度なら前の group が勝つので, 使う側の分け方が優先される.
        build.rolldownOptions = { output: { codeSplitting: { groups: [s2Styles] } } };
      }
      const size = sessionWasmSize();
      return {
        optimizeDeps: {
          exclude: [
            // silica はソースのまま配る. 事前の束ねに入れず, 使う側のソースと同じく変換する (マクロと define を効かせる).
            'silica',
            // マクロのサブパス. 事前の束ねの前の走査はプラグインの変換を通さないので, 普通の import として解決しようとして失敗する.
            '@react-spectrum/s2/style',
          ],
        },
        define: size === undefined ? undefined : { __SILICA_SESSION_WASM_SIZE__: JSON.stringify(size) },
        build,
      };
    },
  };
}

// 出力が複数, 分けない指定, 同じ名前の group が既にある時は足さない.
function canAddGroup(config: UserConfig): boolean {
  const output = config.build?.rolldownOptions?.output;
  if (Array.isArray(output)) return false;
  const codeSplitting = output?.codeSplitting;
  if (codeSplitting === false) return false;
  if (typeof codeSplitting !== 'object') return true;
  return !(codeSplitting.groups ?? []).some((group) => group.name === s2Styles.name);
}

// 展開した後のセッションの wasm の大きさ. src/session/wasm.ts が読み, 読み込みの進捗の割合に使う (#13 の項目 2).
// ここ (src/vite/ か dist/vite/) から見て同じ場所にある. wasm がまだ無い (ビルドしていない) 時は埋めない.
function sessionWasmSize(): number | undefined {
  return statSync(new URL('../../src/session/session.wasm', import.meta.url), { throwIfNoEntry: false })?.size;
}
