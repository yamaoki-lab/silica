// mount: 要素の中にデスクトップを描き, セッションを立ち上げ, アプリケーションを登録して自動起動する.
import { createRoot } from 'react-dom/client';
import { WindowStore } from '../agate/store.ts';
import { loadSession } from '../session/index.ts';
import { sessionWasmSize, sessionWasmUrl } from '../session/wasm.ts';
import type { MountOptions, WindowId } from './app.ts';
import { Desktop } from './Desktop.tsx';
import { claimPage, followSession, launch, toApplications, toLaunchEntries } from './launch.ts';

// デスクトップが出たら解決する. 自動起動したアプリケーションは待たない.
// 拒否するのは silica 自身が立ち上がれない時 (wasm を読めない, 2回目の mount, アプリケーションの id の形の誤りや重複) だけ.
export async function mount(el: HTMLElement, { apps }: MountOptions): Promise<void> {
  claimPage();
  const view = el.ownerDocument.defaultView;
  if (view === null) throw new Error('mount に渡した要素が, ウインドウに表示される文書の中に無い');
  const entries = toLaunchEntries(apps);
  const session = await loadSession(sessionWasmUrl, { applications: toApplications(entries), size: sessionWasmSize });

  // デスクトップは el の大きさに合わせ, 大きさの変化は el を見て追う.
  const store = new WindowStore<WindowId>({ width: el.clientWidth, height: el.clientHeight });
  new view.ResizeObserver(([entry]) => {
    if (entry !== undefined) store.setContainer({ width: entry.contentRect.width, height: entry.contentRect.height });
  }).observe(el);
  const titles = new Map<WindowId, string>();
  followSession(session, store, titles);

  await new Promise<void>((resolve) => {
    createRoot(el).render(<Desktop store={store} titleOf={(id) => titles.get(id) ?? ''} onReady={resolve} />);
  });
  for (const { app, autostart } of entries) {
    if (autostart) void launch(session, app);
  }
}
