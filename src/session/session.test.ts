import { readFileSync } from 'node:fs';
import { expect, test, vi } from 'vitest';
import type * as pb from './gen/silica/session/v1alpha1/session.ts';
import { loadSession } from './load.ts';
import type { Session } from './session.ts';

const wasm = readFileSync(new URL('./session.wasm', import.meta.url));

async function sessionWithInstance(): Promise<Session> {
  const session = await loadSession(new Response(wasm), {
    applications: [{ id: 'yamaoki.editor', singleInstance: false }],
  });
  session.send({ body: { $case: 'openApplication', value: { applicationId: 'yamaoki.editor', newInstance: false } } });
  return session;
}

const openWindow = (title: string): pb.Request => ({
  body: { $case: 'openWindow', value: { instanceId: 1, title, attributes: undefined } },
});

const cases = (events: pb.Event[]) => events.map((event) => event.body?.$case);

test('購読先の中で送ったリクエストのイベントは, 今のイベントの後に配る', async () => {
  const session = await sessionWithInstance();
  const seen: pb.Event[] = [];
  session.subscribe((event) => {
    seen.push(event);
    if (event.body?.$case === 'windowOpened' && event.body.value.window?.title === '書類') {
      session.send(openWindow('パネル'));
    }
  });
  session.send(openWindow('書類'));
  expect(cases(seen)).toEqual(['windowOpened', 'frontWindowChanged', 'windowOpened', 'frontWindowChanged']);
});

test('購読をやめると配らない', async () => {
  const session = await sessionWithInstance();
  const listener = vi.fn();
  const unsubscribe = session.subscribe(listener);
  unsubscribe();
  session.send(openWindow('書類'));
  expect(listener).not.toHaveBeenCalled();
});

test('購読先の1つが例外を投げても, 他の購読先と後のイベントに配る', async () => {
  const session = await sessionWithInstance();
  // 例外は後で投げ直すので, 投げ直す関数を受け取っておく.
  const rethrows: VoidFunction[] = [];
  const spy = vi.spyOn(globalThis, 'queueMicrotask').mockImplementation((callback) => {
    rethrows.push(callback);
  });
  const seen: pb.Event[] = [];
  session.subscribe((event) => {
    if (event.body?.$case === 'windowOpened') throw new Error('購読先の誤り');
  });
  session.subscribe((event) => seen.push(event));
  session.send(openWindow('書類'));
  spy.mockRestore();
  expect(cases(seen)).toEqual(['windowOpened', 'frontWindowChanged']);
  expect(rethrows).toHaveLength(1);
  expect(rethrows[0]).toThrow('購読先の誤り');
});
