// session/testdata/scenarios/ のシナリオを, wasm とラッパーを通して流す. 同じファイルを cargo test でも流す.
// シナリオの JSON はテスト用の生成コード (gen-json) で読み, ページが読む生成コード (gen) でバイト列にする.
import { readdirSync, readFileSync } from 'node:fs';
import { describe, expect, test } from 'vitest';
import type * as pb from './gen/silica/session/v1alpha1/session.ts';
import * as pbJson from './gen-json/silica/session/v1alpha1/session.ts';
import { loadSession } from './load.ts';

interface Scenario {
  name: string;
  steps: { request: unknown; response: unknown; events?: unknown[] }[];
}

const dir = new URL('../../session/testdata/scenarios/', import.meta.url);
const wasm = readFileSync(new URL('./session.wasm', import.meta.url));
const files = readdirSync(dir)
  .filter((name) => name.endsWith('.json'))
  .sort();

test('シナリオがある', () => {
  expect(files.length).toBeGreaterThan(0);
});

for (const file of files) {
  const scenarios: Scenario[] = JSON.parse(readFileSync(new URL(file, dir), 'utf8'));
  describe(file, () => {
    for (const scenario of scenarios) {
      test(scenario.name, async () => {
        // シナリオは登録から書くので, 立ち上げの時には何も登録しない.
        const session = await loadSession(new Response(wasm), { applications: [] });
        const events: pb.Event[] = [];
        session.subscribe((event) => events.push(event));
        for (const [i, step] of scenario.steps.entries()) {
          events.length = 0;
          const response = session.send(pbJson.Request.fromJSON(step.request));
          expect({ response, events }, `手順 ${i + 1}`).toEqual({
            response: pbJson.Response.fromJSON(step.response),
            events: (step.events ?? []).map((event) => pbJson.Event.fromJSON(event)),
          });
        }
      });
    }
  });
}
