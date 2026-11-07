// 起動画面 (#13). index.html に要素とインラインの CSS を差し込み, JS を待たずに出す.
// 128 kbps でもページの読み込みから 128 ms 以内に出すため, index.html 全体を約 2 KB に収める.
// 出すのは値を持たない progress だけにし, 名前やロゴはスプラッシュスクリーンに任せる. 選べるのは色だけにする.
import type { HtmlTagDescriptor, Plugin } from 'vite';
import { bootElementId } from '../boot/ids.ts';

// 1色なら, その色に固定する. light と dark を指定すれば, 画面の外観に合わせて切り替える.
export type BootColor = string | { readonly light: string; readonly dark: string };

export interface BootOptions {
  // 画面の外観. auto は OS の設定に合わせる. 既定は auto.
  readonly scheme?: 'auto' | 'light' | 'dark';
  // 指定しなければ, 外観に合わせたシステムの色 (Canvas) と, ブラウザの既定のアクセントカラーにする.
  readonly background?: BootColor;
  readonly accent?: BootColor;
}

export function silicaBoot(options: BootOptions = {}): Plugin {
  const tags = bootTags(options);
  return {
    name: 'silica:boot',
    transformIndexHtml: () => tags,
  };
}

export function bootTags({ scheme = 'auto', background, accent }: BootOptions): HtmlTagDescriptor[] {
  const declarations = [
    // 後から描くデスクトップの上に重ね, 消すまで覆う.
    'position:fixed',
    'inset:0',
    'z-index:2147483647',
    'display:grid',
    'place-content:center',
    `color-scheme:${scheme === 'auto' ? 'light dark' : scheme}`,
    `background:${background === undefined ? 'Canvas' : cssColor(background)}`,
  ];
  if (accent !== undefined) declarations.push(`accent-color:${cssColor(accent)}`);
  return [
    { tag: 'style', children: `#${bootElementId}{${declarations.join(';')}}`, injectTo: 'head' },
    {
      tag: 'div',
      attrs: { id: bootElementId },
      // 子を要素の記述で渡すと Vite が字下げを入れるので, 1行の HTML で渡す.
      // 値を持たない progress は, 読み込み中であることだけを動きで示す.
      children: '<progress aria-label="読み込み中"></progress>',
      injectTo: 'body-prepend',
    },
  ];
}

function cssColor(color: BootColor): string {
  if (typeof color === 'string') return checkedColor(color);
  return `light-dark(${checkedColor(color.light)},${checkedColor(color.dark)})`;
}

// 色は CSS にそのまま書くので, 宣言や規則を閉じる文字を含むものは不正な指定として拒否する.
function checkedColor(color: string): string {
  if (color === '' || /[;{}<>"'\\]/.test(color)) throw new Error(`silica() の boot の色として使えない: ${JSON.stringify(color)}`);
  return color;
}
