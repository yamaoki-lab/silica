// デスクトップと, その上のウインドウを描く. React はストアの一覧だけを読み, 位置は要素の transform に直接適用する.
import { useCallback, useEffect, useLayoutEffect, useRef, useSyncExternalStore } from 'react';
import type { WindowEntry, WindowStore } from '../agate/store.ts';
import { DesktopSurface, WindowFrame } from '../passion/window.tsx';
import { attachWindowDrag } from './windowDrag.ts';

export interface DesktopProps<Id> {
  store: WindowStore<Id>;
  // ウインドウのタイトル. セッションのイベントで view が持つ.
  titleOf: (id: Id) => string;
  // 初めて描いた時に呼ぶ. mount はこれでデスクトップが出たことを知る.
  onReady?: () => void;
}

export function Desktop<Id>({ store, titleOf, onReady }: DesktopProps<Id>) {
  const subscribe = useCallback((listener: () => void) => store.subscribe(listener), [store]);
  const getSnapshot = useCallback(() => store.entries(), [store]);
  const entries = useSyncExternalStore(subscribe, getSnapshot);
  useEffect(() => onReady?.(), [onReady]);
  // DOM の順は開いた順のまま動かさない. 中の iframe が読み直すため.
  return (
    <DesktopSurface>
      {entries.map((entry) => (
        <DesktopWindow key={String(entry.id)} store={store} entry={entry} title={titleOf(entry.id)} />
      ))}
    </DesktopSurface>
  );
}

function DesktopWindow<Id>({ store, entry, title }: { store: WindowStore<Id>; entry: WindowEntry<Id>; title: string }) {
  const rootRef = useRef<HTMLDivElement>(null);
  const titleBarRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  // 描いた後, 画面に出る前に位置を当て, 以後は位置の購読から書く. React には transform を書かせない.
  useLayoutEffect(() => {
    const root = rootRef.current;
    if (root === null) return;
    const apply = () => {
      const bounds = store.get(entry.id);
      if (bounds !== undefined) root.style.transform = `translate(${bounds.x}px, ${bounds.y}px)`;
    };
    apply();
    return store.subscribePosition(entry.id, apply);
  }, [store, entry.id]);

  // 開いた時に1回, 外側と中身の差から枠の分 (枠線とタイトルバー) を測り, ストアに置かせる.
  // タイトルバーの太さは文字の大きさの設定や S2 の倍率で変わるので, 決め打ちにせず実際に描いたものを測る (旧 console の fit と同じ測り方).
  // 位置の購読の後に置くので, 置いた位置はすぐ上の購読から当たる. どちらも画面に出る前に済むので, 置く前の姿は見えない.
  // offset の値は transform の影響を受けない.
  // デスクトップが display: none の間等, まだ描かれていない時は offset の値が全て 0 で, 枠の分を測れない.
  // その時は描かれるのを待って測る.
  useLayoutEffect(() => {
    const root = rootRef.current;
    const content = contentRef.current;
    if (root === null || content === null) return;
    const measure = () => {
      if (root.offsetWidth === 0 && root.offsetHeight === 0) return false;
      store.place(entry.id, {
        width: root.offsetWidth - content.offsetWidth,
        height: root.offsetHeight - content.offsetHeight,
      });
      return true;
    };
    const view = root.ownerDocument.defaultView;
    if (measure() || view === null) return;
    const observer = new view.ResizeObserver(() => {
      if (measure()) observer.disconnect();
    });
    observer.observe(root);
    return () => observer.disconnect();
  }, [store, entry.id]);

  useEffect(() => {
    const titleBar = titleBarRef.current;
    if (titleBar === null) return;
    return attachWindowDrag(titleBar, store, entry.id);
  }, [store, entry.id]);

  // 前面は2枚目と前面の PR で扱う. それまでは1枚だけなので常に前面.
  return (
    <WindowFrame
      title={title}
      isFrontmost
      width={entry.width}
      height={entry.height}
      rootRef={rootRef}
      titleBarRef={titleBarRef}
      contentRef={contentRef}
    />
  );
}
