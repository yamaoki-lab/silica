// タイトルバーをドラッグしてウインドウを動かす判定. 要素へのイベントの登録と解除は持たず, ポインタの座標だけを見る.
import { DRAG_SLOP, inputKind } from './input.ts';

type Point = { x: number; y: number };

export class DragGesture {
  readonly pointerId: number;
  readonly #origin: Point;
  readonly #slop: number;
  #moving = false;

  private constructor(event: Pick<PointerEvent, 'pointerId' | 'pointerType' | 'clientX' | 'clientY'>) {
    this.pointerId = event.pointerId;
    this.#origin = { x: event.clientX, y: event.clientY };
    this.#slop = DRAG_SLOP[inputKind(event)];
  }

  // ドラッグを始めるのは, 最初のポインタ (2本目の指は使わない) の主ボタン (左のボタン, ペン先, 指) だけ.
  // ペンのサイドスイッチ (2) や消しゴム (5) では始めない.
  static begin(
    event: Pick<PointerEvent, 'isPrimary' | 'button' | 'pointerId' | 'pointerType' | 'clientX' | 'clientY'>,
  ): DragGesture | undefined {
    if (!event.isPrimary || event.button !== 0) return undefined;
    return new DragGesture(event);
  }

  // 押した点からの移動量. 遊びを超えるまでは undefined を返す.
  // 超えた後も押した点から測り, ウインドウの中の押した点がポインタの下に残るようにする.
  update(event: Pick<PointerEvent, 'clientX' | 'clientY'>): Point | undefined {
    const delta = { x: event.clientX - this.#origin.x, y: event.clientY - this.#origin.y };
    if (!this.#moving && Math.hypot(delta.x, delta.y) <= this.#slop) return undefined;
    this.#moving = true;
    return delta;
  }
}
