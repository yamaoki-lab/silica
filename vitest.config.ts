// テストの設定. unit テストは node (unit) で動き, *.browser.test.ts という名前のテストはブラウザで動く.
// ブラウザテストは Playwright で動かす. ローカル環境では Google Chrome と WebKit, CI では macOS 上の Chromium, Firefox, および WebKit を使う (#20).
// ブラウザは --project で選ぶ (pnpm test は unit のみを動かし, pnpm test:browser はローカル環境の 2 つを動かす).
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

// マウスを実際の入力として送る (dispatchEvent で作ったイベントでは, ポインタキャプチャの挙動が実際の入力と異なることがある).
// テストページは iframe の中にあるため, iframe の位置と倍率を適用してページ座標を求める.
const mouse: BrowserCommand<[steps: MouseStep[]]> = async (context, steps) => {
  const frame = await context.frame();
  const element = await frame.frameElement();
  const box = await element.boundingBox();
  if (box === null) throw new Error('テストページの iframe が表示されていない');
  const width = await frame.evaluate<number>('innerWidth');
  const scale = box.width / width;
  for (const step of steps) {
    if (step.type === 'move') {
      await context.page.mouse.move(box.x + step.x * scale, box.y + step.y * scale, { steps: step.steps ?? 1 });
    } else if (step.type === 'down') {
      await context.page.mouse.down();
    } else {
      await context.page.mouse.up();
    }
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
            commands: { mouse, limitNetwork },
            // CSS px 単位でのページのサイズ. ウインドウがデフォルトのサイズで開いて動き回る余裕がある一般的な大きさ.
            viewport: { width: 1280, height: 720 },
            // ウインドウを表示するかどうかはデフォルトに任せる (CI でのみヘッドレスになる).
            // ウインドウを表示する場合でも Vitest UI は表示しない. UI があると, ページが実際のウインドウのサイズと倍率に従うため,
            // deviceScaleFactor を設定できず, ページが縮小表示されて画像やマウスの位置が変わってしまう.
            ui: false,
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
