import type { HtmlTagDescriptor } from 'vite';
import { describe, expect, test } from 'vitest';
import { type BootOptions, bootTags } from './boot.ts';

function styleOf(options: BootOptions): string {
  const style = bootTags(options).find((tag) => tag.tag === 'style');
  if (typeof style?.children !== 'string') throw new Error('style が無い');
  return style.children;
}

function bodyOf(options: BootOptions): HtmlTagDescriptor {
  const body = bootTags(options).find((tag) => tag.injectTo === 'body-prepend');
  if (body === undefined) throw new Error('body の先頭に差し込む要素が無い');
  return body;
}

describe('bootTags', () => {
  test('既定では, OS の外観に合わせたシステムの色で progress だけを出す', () => {
    const style = styleOf({});
    expect(style).toContain('color-scheme:light dark');
    expect(style).toContain('background:Canvas');
    expect(style).not.toContain('accent-color');
    expect(bodyOf({}).attrs).toEqual({ id: 'silica-boot' });
    expect(bodyOf({}).children).toBe('<progress aria-label="読み込み中"></progress>');
  });

  test('light と dark を指定した色は, 外観に合わせて切り替える', () => {
    const style = styleOf({ background: { light: '#fff', dark: '#000' }, accent: { light: '#0097d4', dark: '#33b5e5' } });
    expect(style).toContain('background:light-dark(#fff,#000)');
    expect(style).toContain('accent-color:light-dark(#0097d4,#33b5e5)');
  });

  test('外観を固定すると, 1色ずつの指定がそのまま効く', () => {
    const style = styleOf({ scheme: 'dark', background: '#000', accent: '#0097d4' });
    expect(style).toContain('color-scheme:dark');
    expect(style).toContain('background:#000');
    expect(style).toContain('accent-color:#0097d4');
  });

  test('宣言や規則を閉じる文字を含む色は拒否する', () => {
    expect(() => bootTags({ background: 'red;color:blue' })).toThrow();
    expect(() => bootTags({ background: { light: '#fff', dark: '}' } })).toThrow();
    expect(() => bootTags({ accent: '' })).toThrow();
  });
});
