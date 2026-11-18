import { readFileSync } from 'node:fs';
import { describe, expect, test } from 'vitest';
import { type LoadProgress, loadSession } from './load.ts';

const wasm = readFileSync(new URL('./session.wasm', import.meta.url));

// 3回に分けて届く応答. 取得の進捗が途中の値を出すことを確かめる.
function chunked(headers: Record<string, string> = {}): Response {
  const third = Math.ceil(wasm.length / 3);
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      for (let offset = 0; offset < wasm.length; offset += third) {
        controller.enqueue(wasm.subarray(offset, offset + third));
      }
      controller.close();
    },
  });
  return new Response(stream, { headers });
}

async function progressOf(response: Response, size?: number): Promise<LoadProgress[]> {
  const progress: LoadProgress[] = [];
  await loadSession(response, { applications: [], onProgress: (p) => progress.push(p), size });
  return progress;
}

describe('loadSession', () => {
  test('取得, コンパイル, 立ち上げの順に進み, 取得では読んだバイト数を伝える', async () => {
    const progress = await progressOf(chunked());
    expect(progress.map((p) => p.stage)).toEqual(['fetch', 'fetch', 'fetch', 'fetch', 'compile', 'start']);
    const loaded = progress.filter((p) => p.stage === 'fetch').map((p) => p.loaded);
    expect(loaded[0]).toBe(0);
    expect(loaded.at(-1)).toBe(wasm.length);
    expect(loaded).toEqual([...loaded].sort((a = 0, b = 0) => a - b));
  });

  test('圧縮していない時は, Content-Length を全体の大きさにする', async () => {
    const progress = await progressOf(chunked({ 'content-length': String(wasm.length) }));
    expect(progress.at(-3)).toEqual({ stage: 'fetch', loaded: wasm.length, total: wasm.length });
  });

  test('圧縮している時は, Content-Length を全体の大きさにしない', async () => {
    const progress = await progressOf(chunked({ 'content-length': '100', 'content-encoding': 'gzip' }));
    expect(progress.at(-3)).toEqual({ stage: 'fetch', loaded: wasm.length, total: undefined });
  });

  test('別のオリジンの応答では, Content-Encoding が無くても Content-Length を全体の大きさにしない', async () => {
    // Content-Encoding が Access-Control-Expose-Headers に無く見えない時と同じく, 圧縮した後の大きさだけが見えている.
    const response = chunked({ 'content-length': String(Math.ceil(wasm.length / 2)) });
    Object.defineProperty(response, 'type', { value: 'cors' });
    const fetches = (await progressOf(response)).filter((p) => p.stage === 'fetch');
    expect(fetches.every((p) => p.total === undefined)).toBe(true);
  });

  test('読んだバイト数が全体の大きさを超えたら, それ以降は全体の大きさを伝えない', async () => {
    const half = Math.ceil(wasm.length / 2);
    const fetches = (await progressOf(chunked({ 'content-length': String(half) }))).filter((p) => p.stage === 'fetch');
    expect(fetches.map((p) => p.total)).toEqual([undefined, half, undefined, undefined]);
    expect(fetches.every((p) => p.total === undefined || (p.loaded ?? 0) <= p.total)).toBe(true);
  });

  test('渡された大きさは, 応答の見出しより先に使う', async () => {
    const progress = await progressOf(chunked({ 'content-encoding': 'gzip' }), wasm.length);
    expect(progress.at(-3)).toEqual({ stage: 'fetch', loaded: wasm.length, total: wasm.length });
  });

  test('立ち上げの時に, 渡したアプリケーションを登録する', async () => {
    const session = await loadSession(new Response(wasm), {
      applications: [{ id: 'yamaoki.editor', singleInstance: false }],
    });
    const response = session.send({
      body: { $case: 'openApplication', value: { applicationId: 'yamaoki.editor', newInstance: false } },
    });
    expect(response).toEqual({ body: { $case: 'openApplicationResult', value: { instanceId: 1 } } });
  });

  test('登録できない時は立ち上げに失敗する', async () => {
    const applications = [{ id: 'yamaoki.editor', singleInstance: false }, { id: 'yamaoki.editor', singleInstance: false }];
    await expect(loadSession(new Response(wasm), { applications })).rejects.toThrow(
      'REJECT_REASON_DUPLICATE_APPLICATION',
    );
  });

  test('取得に失敗した時は立ち上げに失敗する', async () => {
    await expect(loadSession(new Response(null, { status: 404 }), { applications: [] })).rejects.toThrow('404');
  });
});
