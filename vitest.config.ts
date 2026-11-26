// テストの設定. unit テストは node (unit) で動き, *.browser.test.ts という名前のテストはブラウザで動く.
// ブラウザテストは Playwright で動かす. ローカル環境では Google Chrome と WebKit, CI では macOS 上の Chromium, Firefox, および WebKit を使う (#20).
// ブラウザは --project で選ぶ (pnpm test は unit のみを動かし, pnpm test:browser はローカル環境の 2 つを動かす).
import { resolve } from 'node:path';
import { playwright } from '@vitest/browser-playwright';
import { defineConfig } from 'vitest/config';
import type { BrowserContext } from 'playwright';
import type { BrowserCommand } from 'vitest/node';
import silica from './src/vite/index.ts';

// テストページの CSS px 単位でのポインタ操作.
export type MouseStep =
  | { type: 'move'; x: number; y: number; steps?: number }
  | { type: 'down' }
  | { type: 'up' };

// テストページは iframe の中にあるため, iframe の位置と倍率を適用して, テストページの座標をページ座標に変換する.
const pageCoordinates = async (context: Parameters<BrowserCommand>[0]) => {
  const frame = await context.frame();
  const element = await frame.frameElement();
  const box = await element.boundingBox();
  if (box === null) throw new Error('テストページの iframe が表示されていない');
  const width = await frame.evaluate<number>('innerWidth');
  const scale = box.width / width;
  return (x: number, y: number) => ({ x: box.x + x * scale, y: box.y + y * scale });
};

// マウスを実際の入力として送る (dispatchEvent で作ったイベントでは, ポインタキャプチャの挙動が実際の入力と異なることがある).
const mouse: BrowserCommand<[steps: MouseStep[]]> = async (context, steps) => {
  const toPage = await pageCoordinates(context);
  for (const step of steps) {
    if (step.type === 'move') {
      const to = toPage(step.x, step.y);
      await context.page.mouse.move(to.x, to.y, { steps: step.steps ?? 1 });
    } else if (step.type === 'down') {
      await context.page.mouse.down();
    } else {
      await context.page.mouse.up();
    }
  }
};

// ペンまたは指の, 筆圧と傾き (度).
export type PointerInput = { type: 'pen' | 'touch'; pressure: number; tiltX: number; tiltY: number };

// ペンと指を実際の入力として送る (#45). Playwright にはペンがなく, 指はタップしか送れないため, Chrome DevTools Protocol を使う.
// CDP は Chromium にしかないため, Chromium でのみ動く. マウスと同様に, move は現在の位置から steps 回に分けて動かす.
const pointer: BrowserCommand<[input: PointerInput, steps: MouseStep[]]> = async (context, input, steps) => {
  const toPage = await pageCoordinates(context);
  const cdp = await context.page.context().newCDPSession(context.page);
  const { type, pressure, tiltX, tiltY } = input;
  let at = { x: 0, y: 0 };
  let down = false;
  const send = async (event: 'press' | 'move' | 'release') => {
    if (type === 'pen') {
      const kind = { press: 'mousePressed', move: 'mouseMoved', release: 'mouseReleased' } as const;
      await cdp.send('Input.dispatchMouseEvent', {
        type: kind[event],
        ...at,
        pointerType: 'pen',
        button: 'left',
        buttons: down ? 1 : 0,
        clickCount: event === 'move' ? 0 : 1,
        force: down ? pressure : 0,
        tiltX,
        tiltY,
      });
    } else if (down || event === 'release') {
      const kind = { press: 'touchStart', move: 'touchMove', release: 'touchEnd' } as const;
      const touchPoints = event === 'release' ? [] : [{ ...at, id: 1, force: pressure, tiltX, tiltY }];
      await cdp.send('Input.dispatchTouchEvent', { type: kind[event], touchPoints });
    }
  };
  try {
    for (const step of steps) {
      if (step.type === 'move') {
        const from = at;
        const to = toPage(step.x, step.y);
        const count = step.steps ?? 1;
        for (let i = 1; i <= count; i++) {
          at = { x: from.x + ((to.x - from.x) * i) / count, y: from.y + ((to.y - from.y) * i) / count };
          await send('move');
        }
      } else if (step.type === 'down') {
        down = true;
        await send('press');
      } else {
        down = false;
        await send('release');
      }
    }
  } finally {
    await cdp.detach();
  }
};

// テストページの中で selector に当たる要素のテキストを描画した, 実際のフォント (#45). Chromium でのみ動く.
// CSS の font-family の指定ではなく, OS のフォントのどれが使われたかを, フォントごとの字数とともに返す.
const platformFonts: BrowserCommand<[selector: string]> = async (context, selector) => {
  const cdp = await context.page.context().newCDPSession(context.page);
  try {
    await cdp.send('DOM.enable');
    await cdp.send('CSS.enable');
    const frame = await context.frame();
    // テストページの文書を, iframe 越しに辿って探す.
    const { root } = await cdp.send('DOM.getDocument', { depth: -1, pierce: true });
    const url = frame.url();
    type Node = { nodeId: number; documentURL?: string; children?: Node[]; contentDocument?: Node };
    const find = (node: Node): Node | undefined =>
      node.documentURL === url ? node : [...(node.children ?? []), ...(node.contentDocument ? [node.contentDocument] : [])].map(find).find(Boolean);
    const document = find(root);
    if (document === undefined) throw new Error('テストページの文書が見つからない');
    const { nodeId } = await cdp.send('DOM.querySelector', { nodeId: document.nodeId, selector });
    if (nodeId === 0) throw new Error(`${selector} に当たる要素がない`);
    const { fonts } = await cdp.send('CSS.getPlatformFontsForNode', { nodeId });
    return fonts.map(({ familyName, glyphCount }) => ({ familyName, glyphCount }));
  } finally {
    await cdp.detach();
  }
};

// テストがアクセスできるホスト. テストサーバは localhost 上にある.
const localHosts = ['localhost', '127.0.0.1', '[::1]'];
const allowedHosts = new WeakMap<BrowserContext, Set<string>>();

// 結果がネットワークに左右されないよう, localhost 以外のホストへのリクエストを拒否する (たとえば S2 は Typekit から日本語フォントを読み込む).
// 別のホストが必要なテストではそのホストを渡す. 通過させたリクエストは, Vitest のモックなど他のハンドラへ進む.
const limitNetwork: BrowserCommand<[hosts?: string[]]> = async ({ context }, hosts = []) => {
  let allowed = allowedHosts.get(context);
  if (allowed === undefined) {
    allowed = new Set(localHosts);
    allowedHosts.set(context, allowed);
    const current = allowed;
    await context.route('**/*', (route) =>
      current.has(new URL(route.request().url()).hostname) ? route.fallback() : route.abort('blockedbyclient'),
    );
  }
  for (const host of hosts) allowed.add(host);
};

const browser = (name: string, browser: 'chromium' | 'firefox' | 'webkit', channel?: string) => ({
  name,
  browser,
  // HiDPI ディスプレイと同様に, 2 倍の倍率で描画する.
  // silica のほとんどのユーザと同様に, ブラウザを日本語に設定する. S2 はブラウザの言語から Provider に lang を設定するため, ページの lang="ja" を上書きしてしまう.
  provider: playwright({ launchOptions: { channel }, contextOptions: { deviceScaleFactor: 2, locale: 'ja-JP' } }),
});

export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: 'unit',
          include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
          exclude: ['src/**/*.browser.test.ts', 'src/**/*.browser.test.tsx'],
        },
      },
      {
        // アプリケーションが使うものと同じプラグインを使い, 実際の利用時と同じ状態で silica をテストできるようにする (S2 マクロ, セッションの wasm のサイズ, 起動画面).
        plugins: [silica()],
        test: {
          name: 'browser',
          include: ['src/**/*.browser.test.ts', 'src/**/*.browser.test.tsx'],
          setupFiles: ['./src/testdata/setup.ts'],
          browser: {
            enabled: true,
            // 漢字が日本の字体で描画されるよう, テストページに lang="ja" を指定する.
            testerHtmlPath: './src/testdata/tester.html',
            commands: { mouse, pointer, platformFonts, limitNetwork },
            // CSS px 単位でのページのサイズ. ウインドウがデフォルトのサイズで開いて動き回る余裕がある一般的な大きさ.
            viewport: { width: 1280, height: 720 },
            // ウインドウを表示するかどうかはデフォルトに任せる (CI でのみヘッドレスになる).
            // ウインドウを表示する場合でも Vitest UI は表示しない. UI があると, ページが実際のウインドウのサイズと倍率に従うため,
            // deviceScaleFactor を設定できず, ページが縮小表示されて画像やマウスの位置が変わってしまう.
            ui: false,
            expect: {
              toMatchScreenshot: {
                // CI で撮影した基準画像のみをコミットする (#20). ローカル環境では OS のバージョンとブラウザのチャネルが CI と異なるため, 画像が一致しない.
                // ローカル環境では, 基準画像を Git が無視するディレクトリに置き, 実行ごとに前回のローカル実行と比較する.
                // chrome と chromium はどちらも browserName が chromium なので同じパスになるが, ローカル環境では chrome だけを (pnpm test:browser), CI では chromium だけを実行するため区別しない.
                resolveScreenshotPath: ({ arg, ext, root, screenshotDirectory, testFileDirectory, testFileName, browserName, platform }) =>
                  process.env.CI
                    ? resolve(root, testFileDirectory, screenshotDirectory, testFileName, `${arg}-${browserName}-${platform}${ext}`)
                    : resolve(root, 'test-results/screenshots', testFileDirectory, testFileName, `${arg}-${browserName}-${platform}${ext}`),
              },
            },
            instances: [
              browser('chrome', 'chromium', 'chrome'),
              browser('chromium', 'chromium'),
              browser('firefox', 'firefox'),
              browser('webkit', 'webkit'),
            ],
          },
        },
      },
    ],
  },
});
