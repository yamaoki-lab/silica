import macros from 'unplugin-parcel-macros';
import { describe, expect, test } from 'vitest';
import { handledHooks, isMacroTarget } from './macros.ts';

describe('isMacroTarget', () => {
  test.each([
    ['/app/src/main.tsx', true],
    ['/app/node_modules/silica/src/view/Desktop.tsx', true],
    ['/app/node_modules/.pnpm/silica@file+silica.tgz/node_modules/silica/src/index.ts', true],
    ['/app/node_modules/react/index.js', false],
    ['/app/node_modules/silica-extra/src/index.ts', false],
    ['/app/node_modules/silica/node_modules/react/index.js', false],
    ['/app/src/style.css', false],
    ['/app/src/main.tsx?import', false],
  ])('%s → %s', (id, expected) => {
    expect(isMacroTarget(id)).toBe(expected);
  });
});

test('元のプラグインのフックは, 全て載せ替えている', () => {
  const raws = [macros.raw(undefined, { framework: 'vite' })].flat();
  for (const raw of raws) {
    expect(handledHooks).toEqual(expect.arrayContaining(Object.keys(raw)));
  }
});
