import { readFileSync } from 'node:fs';
import { describe, expect, test, vi } from 'vitest';
import { WindowStore } from '../agate/store.ts';
import { loadSession } from '../session/index.ts';
import type { AppDeclaration, AppStart, WindowId } from './app.ts';
import { claimPage, followSession, launch, toApplications, toLaunchEntries } from './launch.ts';

const wasm = readFileSync(new URL('../session/session.wasm', import.meta.url));

const declare = (id: string, start: AppStart = () => {}): AppDeclaration => ({
  id,
  name: id,
  load: async () => ({ default: start }),
});

async function desktop(apps: AppDeclaration[]) {
  const session = await loadSession(new Response(wasm), { applications: toApplications(toLaunchEntries(apps)) });
  const store = new WindowStore<WindowId>({ width: 1280, height: 720 });
  const titles = new Map<WindowId, string>();
  followSession(session, store, titles);
  return { session, store, titles };
}

test('宣言そのものは自動起動しない組にし, 組はそのまま使う', () => {
  const hello = declare('yamaoki.example.hello');
  const editor = declare('yamaoki.example.editor');
  expect(toLaunchEntries([hello, { app: editor, autostart: true }, { app: hello }])).toEqual([
    { app: hello, autostart: false },
    { app: editor, autostart: true },
    { app: hello, autostart: false },
  ]);
});

test('mount は1つのページで1回だけ', () => {
  claimPage();
  expect(() => claimPage()).toThrow('1回だけ');
});

describe('launch', () => {
  test('起動関数が開いたウインドウを, タイトルと一緒にストアに追加する', async () => {
    let opened: WindowId | undefined;
    const hello = declare('yamaoki.example.hello', ({ openWindow }) => {
      opened = openWindow({ title: 'こんにちは' });
    });
    const { session, store, titles } = await desktop([hello]);
    await launch(session, hello);
    expect(opened).toBeDefined();
    expect(store.entries().map((entry) => entry.id)).toEqual([opened]);
    expect(titles.get(opened!)).toBe('こんにちは');
  });

  test('閉じたウインドウはストアから消す', async () => {
    let opened: WindowId | undefined;
    const hello = declare('yamaoki.example.hello', ({ openWindow }) => {
      opened = openWindow({ title: 'こんにちは' });
    });
    const { session, store, titles } = await desktop([hello]);
    await launch(session, hello);
    session.send({ body: { $case: 'closeWindow', value: { windowId: opened! } } });
    expect(store.entries()).toEqual([]);
    expect(titles.size).toBe(0);
  });

  test('起動の失敗は例外にせず, 報告に渡す', async () => {
    const broken: AppDeclaration = { id: 'yamaoki.example.broken', name: 'broken', load: () => Promise.reject(new Error('読めない')) };
    const { session } = await desktop([broken]);
    const report = vi.fn();
    await expect(launch(session, broken, report)).resolves.toBeUndefined();
    expect(report).toHaveBeenCalledWith('アプリケーション yamaoki.example.broken を起動できなかった', new Error('読めない'));
  });

  test('登録していないアプリケーションは, 起動の失敗として報告に渡す', async () => {
    const { session } = await desktop([]);
    const report = vi.fn();
    await launch(session, declare('yamaoki.example.hello'), report);
    expect(report).toHaveBeenCalledOnce();
  });
});

describe('登録', () => {
  test.for([
    ['形の誤った id', [declare('hello')]],
    ['重複した id', [declare('yamaoki.example.hello'), declare('yamaoki.example.hello')]],
  ] as const)('%s は登録を断る', async ([, apps]) => {
    await expect(desktop([...apps])).rejects.toThrow('アプリケーションを登録できなかった');
  });
});
