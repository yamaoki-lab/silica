import { expect, test } from 'vitest';
import { page } from 'vitest/browser';
import { openTestWindow } from '../testdata/openTestWindow.ts';

// 日本語のテキストの画像を比較し, 各ブラウザと OS が日本語フォントで描画していることを確かめる.
// 漢字には日本と中国で字体が異なるもの (直, 骨, 角, 誤, 令, 化, 紙・線・続・結の糸へん, および道) を含める.
// このテキストは実際のウインドウのタイトルなので, silica が使うフォントで描画される.
test('日本語のテキストを描画する', async () => {
  const titleBar = await openTestWindow('直骨角誤令化 紙線続結道 ウインドウを閉じる');
  await expect.element(page.elementLocator(titleBar)).toMatchScreenshot('japanese');
});
