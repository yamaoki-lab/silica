// セッションがページに足す量を測り, サイズ上限を超えたら失敗する (pnpm check:size).
// 先に pnpm gen と pnpm build:wasm を済ませておく.
// 測るのは, 縮めた wasm と, ラッパーと生成コードと protobuf の実行部を束ねて minify した JS.
// 配る時と同じく, それぞれを gzip -9 にした大きさの合計で比べる.
import { appendFileSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';
import { build, type Rolldown } from 'vite';

// サイズ上限 (#8). 128 kbps で約2秒.
const LIMIT = 32 * 1024;

const root = fileURLToPath(new URL('..', import.meta.url));
// ラッパーができるまでは, 生成コードをエントリにして測る.
const entry = 'src/session/gen/silica/session/v1alpha1/session.ts';
const wasm = 'src/session/session.wasm';

// 使う側のビルドに近づけるため, リポジトリの設定 (ライブラリ用で minify しない) は読まない.
// ライブラリの形で出すと空白が残るので, エントリの書き出しを残したアプリケーションの形で束ねる.
const result = await build({
  configFile: false,
  logLevel: 'silent',
  root,
  build: {
    write: false,
    minify: true,
    target: 'esnext',
    modulePreload: false,
    rolldownOptions: { input: entry, preserveEntrySignatures: 'strict' },
  },
});
const outputs = (Array.isArray(result) ? result : [result]) as Rolldown.RolldownOutput[];
const js = outputs
  .flatMap((output) => output.output)
  .filter((file) => file.type === 'chunk')
  .map((chunk) => chunk.code)
  .join('');

const rows = [
  { name: 'wasm', bytes: readFileSync(join(root, wasm)) },
  { name: 'JS', bytes: Buffer.from(js) },
].map(({ name, bytes }) => ({ name, raw: bytes.length, gzip: gzipSync(bytes, { level: 9 }).length }));
const total = rows.reduce((sum, row) => sum + row.gzip, 0);
const ok = total <= LIMIT;

const format = (bytes: number) => `${bytes.toLocaleString('en-US')} (${(bytes / 1024).toFixed(1)} KiB)`;
const table = [
  '| | 縮めた後 | gzip |',
  '|---|---|---|',
  ...rows.map((row) => `| ${row.name} | ${format(row.raw)} | ${format(row.gzip)} |`),
  `| 合計 | | ${format(total)} |`,
].join('\n');
const report = `## セッションの大きさ\n\n${table}\n\n上限 ${format(LIMIT)} に対して${ok ? '収まっている' : '超えている'}.\n`;

console.log(report);
if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, report);
if (!ok) process.exitCode = 1;
