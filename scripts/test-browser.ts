// ローカル環境でブラウザテストを実行する (pnpm test:browser). 先に pnpm gen と pnpm build:wasm を済ませておく.
// ウインドウが重なって見づらくならないよう, 1 ブラウザずつ順に実行する.
// 引数 (--update やテストファイルなど) はすべてのブラウザに渡し, 途中で失敗しても残りのブラウザを実行する.
import { spawnSync } from 'node:child_process';

const projects = ['chrome', 'webkit'];
const args = process.argv.slice(2);

let failed = false;
for (const project of projects) {
  const result = spawnSync('vitest', ['run', `--project=${project}`, '--no-file-parallelism', ...args], { stdio: 'inherit' });
  if (result.status !== 0) failed = true;
}
process.exit(failed ? 1 : 0);
