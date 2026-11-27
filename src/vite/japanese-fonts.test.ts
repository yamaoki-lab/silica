import { readdirSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { describe, expect, test } from 'vitest';
import { rewriteCss, rewriteFonts } from './japanese-fonts.ts';

// インストールされている Spectrum 2 の dist/private フォルダ. アップデートによって書き換えが機能しなくなった場合, これらのテストで検知できる.
const s2Private = join(dirname(createRequire(import.meta.url).resolve('@react-spectrum/s2/package.json')), 'dist/private');
const s2File = (name: string) => join(s2Private, name);

const gothic =
  "font-family: 'Heisei Maru Gothic Std', '平成丸ゴシック Std', 'Hiragino Sans', 'Hiragino Kaku Gothic ProN', system-ui, sans-serif; font-synthesis: none;";

describe('rewriteCss', () => {
  test('Spectrum 2 の CSS 内の日本語フォントスタックを置き換え, 他の言語は変更しない', () => {
    const files = readdirSync(s2Private).filter((name) => name.endsWith('.css'));
    const targets = files.filter((name) => readFileSync(s2File(name), 'utf8').includes('adobe-clean-han-japanese'));
    expect(targets.length).toBeGreaterThan(0);
    for (const name of targets) {
      const code = readFileSync(s2File(name), 'utf8');
      const css = rewriteCss(code, s2File(name));
      expect(css).toContain(gothic);
      expect(css).not.toContain('adobe-clean-han-japanese');
      expect(css).toContain('adobe-clean-han-korean');
    }
  });

  test('マクロによって生成された CSS 内でも同様に置き換える', () => {
    const code = '.a:lang(ja) {\n  font-family: adobe-clean-han-japanese, Hiragino Kaku Gothic ProN, sans-serif;\n}';
    expect(rewriteCss(code, `macro-${'0'.repeat(64)}.css`)).toBe(`.a:lang(ja) {\n  ${gothic}\n}`);
  });

  test.each([
    ['/app/src/style.css'],
    ['/app/node_modules/@react-spectrum/s2/dist/private/Fonts.mjs'],
    ['macro-abc.css'],
  ])('対象外のファイル (%s) は変更しない', (id) => {
    const code = '.a:lang(ja) { font-family: adobe-clean-han-japanese, sans-serif; }';
    expect(rewriteCss(code, id)).toBeUndefined();
  });
});

describe('rewriteFonts', () => {
  const fonts = s2File('Fonts.mjs');

  test('インストールされている Spectrum 2 の Fonts.mjs で, 日本語に対してのみ Typekit とプリロードを停止する', () => {
    const code = rewriteFonts(readFileSync(fonts, 'utf8'), fonts);
    expect(code).toContain("let script = locale.language !== 'ja' && typekitId ?");
    expect(code).toContain("if (locale.language !== 'ja' && preloadUrls &&");
  });

  test('他のファイルは変更しない', () => {
    expect(rewriteFonts('let x = 1;', '/app/node_modules/@react-spectrum/s2/dist/private/Provider.mjs')).toBeUndefined();
  });

  test('書き換え対象のコードが見つからない場合は失敗する', () => {
    expect(() => rewriteFonts('let x = 1;', fonts)).toThrow();
  });
});
