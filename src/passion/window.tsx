// デスクトップとウインドウの見た目. S2 を読むのは passion だけにし, view は S2 を直接使わない.
// 見た目を S2 から差し替える時に, passion の中だけを替えれば済むようにするため. props にも S2 の型を出さない.
import { Provider } from '@react-spectrum/s2';
import { style } from '@react-spectrum/s2/style' with { type: 'macro' };
import type { ReactNode, Ref } from 'react';

const desktop = style({
  position: 'relative',
  width: 'full',
  height: 'full',
  overflow: 'hidden',
});

export function DesktopSurface({ children }: { children?: ReactNode }) {
  return (
    <Provider background="base" styles={desktop}>
      {children}
    </Provider>
  );
}

// 値と構成は旧 console の WindowFrame に揃える.
// 位置と大きさを持つ要素と枠を分けるのは, 後で足すリサイズのつまみを枠の外にはみ出して置くため.
const windowRoot = style({
  position: 'absolute',
  top: 0,
  left: 0,
});

// border-box は console との違い. 枠線を外側の要素の大きさの内に収め, 見えるウインドウの大きさをストアの大きさと一致させる.
const frame = style({
  display: 'flex',
  flexDirection: 'column',
  boxSizing: 'border-box',
  width: 'full',
  height: 'full',
  backgroundColor: 'layer-1',
  borderRadius: 'lg',
  borderWidth: 1,
  borderStyle: 'solid',
  borderColor: 'gray-300',
  boxShadow: 'elevated',
  overflow: 'hidden',
});

// 左右の列は閉じるボタンと他のボタンの場所. 両端を同じ 1fr にして, タイトルをウインドウの中央に置く.
// タイトルの文字は, OS のウインドウと同じく選べないようにする.
// 中身では指で普通にスクロールできるよう, touch-action はタイトルバーだけに付ける.
const titleBar = style({
  display: 'grid',
  gridTemplateColumns: '1fr minmax(0, auto) 1fr',
  alignItems: 'center',
  gap: 8,
  padding: 4,
  backgroundColor: 'layer-2',
  userSelect: 'none',
  touchAction: 'none',
  cursor: 'default',
});

// 前面でないウインドウは文字を薄くする. 前面を扱うのは2枚目と前面の PR からで, それまでは常に前面として描く.
const titleText = style({
  gridColumnStart: 2,
  font: 'ui',
  textAlign: 'center',
  truncate: true,
  minWidth: 0,
  color: {
    default: 'neutral-subdued',
    isFrontmost: 'neutral',
  },
});

const contentArea = style({
  flexGrow: 1,
  position: 'relative',
  overflow: 'auto',
});

export interface WindowFrameProps {
  title: string;
  isFrontmost: boolean;
  // ウインドウ全体 (枠とタイトルバーを含む) の大きさ.
  width: number;
  height: number;
  // 位置は view が transform で当てるので, 一番外の要素を渡す.
  rootRef?: Ref<HTMLDivElement>;
  // ドラッグを受ける要素.
  titleBarRef?: Ref<HTMLDivElement>;
  // 中身の要素. view が外側との差を測り, 枠の分を出す.
  contentRef?: Ref<HTMLDivElement>;
  children?: ReactNode;
}

export function WindowFrame({
  title,
  isFrontmost,
  width,
  height,
  rootRef,
  titleBarRef,
  contentRef,
  children,
}: WindowFrameProps) {
  return (
    <div ref={rootRef} className={windowRoot} style={{ width, height }}>
      <div className={frame}>
        <div ref={titleBarRef} className={titleBar}>
          <span className={titleText({ isFrontmost })}>{title}</span>
        </div>
        <div ref={contentRef} className={contentArea}>
          {children}
        </div>
      </div>
    </div>
  );
}
