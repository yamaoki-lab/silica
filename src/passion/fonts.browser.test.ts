import { test } from 'vitest';
import { page, server } from 'vitest/browser';
import { openTestWindow } from '../testdata/openTestWindow.ts';

// 各ブラウザと OS が日本語フォントで描画しているかを目で確かめるため, 日本語のテキストの画像を撮影する.
// 漢字には日本と中国で字体が異なるもの (直, 骨, 角, 誤, 令, 化, 紙・線・続・結の糸へん, および道) を含める.
// このテキストは実際のウインドウのタイトルなので, silica が使うフォントで描画される.
// まだ比較は行わない. これらの画像は次の PR (#20) で基準画像になる.
test('日本語のテキストを描画する', async () => {
  const titleBar = await openTestWindow('直骨角誤令化 紙線続結道 ウインドウを閉じる');
  await page.screenshot({ element: titleBar, path: `../../test-results/fonts/japanese-${server.browser}-${server.platform}.png` });
});
