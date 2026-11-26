import { beforeAll, expect, test } from 'vitest';
import { page } from 'vitest/browser';
import { openTestWindow } from '../testdata/openTestWindow.ts';

// mount で開いた実際のウインドウ. このファイルではウインドウを動かさない.
let titleBar: HTMLElement;

beforeAll(async () => {
  titleBar = await openTestWindow('タイトル');
});

// 以前に作成した部品の見た目が気づかないうちに崩れないよう, 開いた直後のウインドウを基準画像と比較する.
// ウインドウを動かすテストと同じページで撮影すると実行順に依存するため, ファイルを分けている.
test('ウインドウを描画する', async () => {
  await expect.element(page.elementLocator(titleBar.parentElement!)).toMatchScreenshot('window');
});
