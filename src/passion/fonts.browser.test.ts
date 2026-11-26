import { beforeAll, expect, test } from 'vitest';
import { commands, page, server } from 'vitest/browser';
import { openTestWindow } from '../testdata/openTestWindow.ts';

declare module 'vitest/browser' {
  interface BrowserCommands {
    platformFonts: (selector: string) => Promise<{ familyName: string; glyphCount: number }[]>;
  }
}

// 漢字には日本と中国で字体が異なるもの (直, 骨, 角, 誤, 令, 化, 紙・線・続・結の糸へん, および道) を含める.
// このテキストは実際のウインドウのタイトルなので, silica が使うフォントで描画される.
const text = '直骨角誤令化 紙線続結道 ウインドウを閉じる';
let titleBar: HTMLElement;

beforeAll(async () => {
  titleBar = await openTestWindow(text);
});

// 日本語のテキストの画像を比較し, 各ブラウザと OS が日本語フォントで描画していることを確かめる.
test('日本語のテキストを描画する', async () => {
  await expect.element(page.elementLocator(titleBar)).toMatchScreenshot('japanese');
});

// 画像の比較では, 画像が変わった時にしかフォントの変化に気づかないため, Chromium では使われたフォントの名前も確かめる (#45).
// すべての字 (空白を含む) が, 中国の字体のフォントや別のフォントに置き換わらず, 1 つの日本語フォントで描画されている.
test.runIf(server.browser === 'chromium')('日本語のテキストを日本語フォントで描画する', async () => {
  titleBar.firstElementChild!.setAttribute('data-test-title', '');
  expect(await commands.platformFonts('[data-test-title]')).toEqual([
    { familyName: 'Hiragino Kaku Gothic ProN', glyphCount: text.length },
  ]);
});
