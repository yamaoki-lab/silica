import type { Plugin, Rolldown } from 'vite';

const japaneseSans =
  "'Heisei Maru Gothic Std', '平成丸ゴシック Std', 'Hiragino Sans', 'Hiragino Kaku Gothic ProN', system-ui, sans-serif";
const s2Css = /\/@react-spectrum\/s2\/dist\/private\/[^/]+\.css$/;
const macroCss = /^macro-[a-f0-9]{64}\.css$/;
const s2Fonts = /\/@react-spectrum\/s2\/dist\/private\/Fonts\.mjs$/;

function modulePath(id: string): string {
  return id.replace(/\?.*$/, '').replaceAll('\\', '/');
}

export function rewriteFonts(code: string, id: string): string | undefined {
  if (!s2Fonts.test(modulePath(id))) return;

  // 日本語の場合は URL を null に設定し, React 19 以降向けのスクリプトとそれ以前のバージョン向けのエフェクトの両方を停止する.
  const script = 'let script = typekitId ? `https://use.typekit.net/${typekitId}.js` : null;';
  // 日本語でスクリプトをスキップすると英語のプリロード処理へフォールスルーするため, 日本語ではその読み込みも停止する.
  const preload = 'if (preloadUrls &&';
  if (!code.includes(script) || !code.includes(preload)) {
    throw new Error('Spectrum 2 の Fonts モジュールが変更されました. 日本語フォントのオーバーライドを再度確認してください.');
  }
  return code
    .replace(script, script.replace('typekitId ?', "locale.language !== 'ja' && typekitId ?"))
    .replace(preload, "if (locale.language !== 'ja' && preloadUrls &&");
}

export function silicaJapaneseFonts(): Plugin {
  // 開発環境では, Spectrum 2 の JS は依存関係の事前バンドルを通る. CSS は通常の Vite の transform に渡される.
  const optimizerPlugin: Rolldown.Plugin = {
    name: 'silica:japanese-font-script',
    transform: {
      filter: { id: s2Fonts },
      handler: rewriteFonts,
    },
  };
  return {
    name: 'silica:japanese-fonts',
    enforce: 'pre',
    config() {
      return { optimizeDeps: { rolldownOptions: { plugins: [optimizerPlugin] } } };
    },
    transform(code, id) {
      return rewriteCss(code, id) ?? rewriteFonts(code, id);
    },
  };
}

export function rewriteCss(code: string, id: string): string | undefined {
  const path = modulePath(id);
  if (!s2Css.test(path) && !macroCss.test(path)) return;

  const css = code.replace(
    /(:lang\(ja\)\s*\{\s*font-family:\s*)adobe-clean-han-japanese\s*,[^;{}]+;/g,
    `$1${japaneseSans}; font-synthesis: none;`,
  );
  if (css !== code) return css;
}
