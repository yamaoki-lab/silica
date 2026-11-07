// ポインタの入力の種類を読む所. pointerType 等を読むのはここだけにする.
// 後でシェルが入力の情報 (マウスとトラックパッドの区別等) を渡せるようになった時に, ここで上書きするため.

export type InputKind = 'mouse' | 'pen' | 'touch';

export function inputKind(event: Pick<PointerEvent, 'pointerType'>): InputKind {
  switch (event.pointerType) {
    case 'pen':
      return 'pen';
    case 'touch':
      return 'touch';
    default:
      return 'mouse';
  }
}

// ドラッグの動き始めの遊び. 押した点からこの距離 (CSS px) を超えて動くまでは動かさず, 押しただけで動かないようにする.
// マウスの 4 とタッチの 8 は, 主なデスクトップ環境とタッチ環境の既定の値に合わせた. ペンの 6 は仮の値.
export const DRAG_SLOP: Readonly<Record<InputKind, number>> = { mouse: 4, pen: 6, touch: 8 };
