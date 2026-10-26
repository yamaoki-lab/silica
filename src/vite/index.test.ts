import { statSync } from 'node:fs';
import type { ConfigEnv, Plugin, UserConfig } from 'vite';
import { describe, expect, test } from 'vitest';
import silica from './index.ts';

const env: ConfigEnv = { command: 'build', mode: 'production' };

// silica() が使う側の設定に混ぜる値.
function configFor(config: UserConfig): UserConfig {
  const plugin = silica().find((p): p is Plugin => p.name === 'silica:config');
  const hook = plugin?.config;
  if (typeof hook !== 'function') throw new Error('silica:config の config フックが無い');
  return Reflect.apply(hook, {}, [config, env]);
}

function groupsOf(config: UserConfig): unknown {
  const output = config.build?.rolldownOptions?.output;
  if (Array.isArray(output) || typeof output?.codeSplitting !== 'object') return undefined;
  return output.codeSplitting.groups?.map((group) => group.name);
}

describe('silica', () => {
  test('マクロのプラグインを先に動かす', () => {
    const plugins = silica();
    expect(plugins.map((p) => p.name)).toEqual(['silica:unplugin-macros', 'silica:config']);
    expect(plugins[0]?.enforce).toBe('pre');
  });

  test('事前の束ねから silica とマクロのサブパスを外す', () => {
    expect(configFor({}).optimizeDeps?.exclude).toEqual(['silica', '@react-spectrum/s2/style']);
  });

  test('セッションの wasm の展開した後の大きさを埋める', () => {
    const size = statSync(new URL('../session/session.wasm', import.meta.url)).size;
    expect(configFor({}).define).toEqual({ __SILICA_SESSION_WASM_SIZE__: String(size) });
  });

  test('target は, 使う側が書いていなければ esnext にする', () => {
    expect(configFor({}).build?.target).toBe('esnext');
    expect(configFor({ build: { target: 'es2024' } }).build?.target).toBeUndefined();
  });

  test('S2 の CSS を1つにまとめる group を足す', () => {
    expect(groupsOf(configFor({}))).toEqual(['s2-styles']);
    expect(groupsOf(configFor({ build: { rolldownOptions: { output: { codeSplitting: true } } } }))).toEqual([
      's2-styles',
    ]);
  });

  test('使う側が分けない, 出力が複数, 同じ名前の group がある時は足さない', () => {
    const configs: UserConfig[] = [
      { build: { rolldownOptions: { output: { codeSplitting: false } } } },
      { build: { rolldownOptions: { output: [{}, {}] } } },
      { build: { rolldownOptions: { output: { codeSplitting: { groups: [{ name: 's2-styles', test: /x/ }] } } } } },
    ];
    for (const config of configs) {
      expect(configFor(config).build?.rolldownOptions).toBeUndefined();
    }
  });
});
