// 場面の JSON はテスト用の生成コード (gen-json) で読み, ページが読む生成コード (gen) でバイト列にする.
// 2つの生成コードが同じ型とバイト列になることを確かめる.
import { expect, test } from 'vitest';
import * as pb from './gen/silica/session/v1alpha1/session.ts';
import * as pbJson from './gen-json/silica/session/v1alpha1/session.ts';

test('場面の JSON の頼みごとがバイト列を往復する', () => {
  const request: pb.Request = pbJson.Request.fromJSON({ listWindows: {} });
  expect(request).toEqual({ body: { $case: 'listWindows', value: {} } });
  const decoded = pb.Request.decode(pb.Request.encode(request).finish());
  expect(decoded).toEqual(request);
});
