// タイトルバーの要素にドラッグを付ける. 判定は DragGesture に任せ, ここはイベントの登録と解除と, ストアへの書き込みを持つ.
import type { WindowStore } from '../agate/store.ts';
import { DragGesture } from './drag.ts';

type Point = { x: number; y: number };

// 返した関数で外す.
export function attachWindowDrag<Id>(handle: HTMLElement, store: WindowStore<Id>, id: Id): () => void {
  const doc = handle.ownerDocument;
  const view = doc.defaultView;
  if (view === null) return () => {};
  let gesture: DragGesture | undefined;
  let captured = false;
  let start: Point = { x: 0, y: 0 };
  let pending: Point | undefined;
  let frame = 0;

  // ストアへの書き込みは1フレームに1回まで. pointermove は1フレームに何度も来ることがある.
  const flush = () => {
    frame = 0;
    if (pending === undefined) return;
    store.move(id, pending);
    pending = undefined;
  };

  // ポインタをキャプチャするのは, 遊びを超えて動き始めた時. 押した時にキャプチャすると, 離した時の pointerup と click が
  // タイトルバーに届き, タイトルバーの中のボタン (閉じるボタン等) が押せなくなる.
  // 動き始めるまでは document 上でポインタを追跡し, 遊びを超える前にタイトルバーの外へ出ても追えるようにする.
  const onDown = (event: PointerEvent) => {
    if (gesture !== undefined) return;
    const bounds = store.get(id);
    const next = DragGesture.begin(event);
    if (bounds === undefined || next === undefined) return;
    gesture = next;
    captured = false;
    start = { x: bounds.x, y: bounds.y };
    for (const [type, listener] of tracking) doc.addEventListener(type, listener, true);
  };

  const onMove = (event: PointerEvent) => {
    if (gesture === undefined || event.pointerId !== gesture.pointerId) return;
    const delta = gesture.update(event);
    if (delta === undefined) return;
    if (!captured) {
      captured = true;
      handle.setPointerCapture(event.pointerId);
    }
    pending = { x: start.x + delta.x, y: start.y + delta.y };
    if (frame === 0) frame = view.requestAnimationFrame(flush);
  };

  // 離した時も, 途切れた時 (pointercancel, lostpointercapture) も, 残りを先に当ててその位置で終える.
  const onEnd = (event: PointerEvent) => {
    if (gesture === undefined || event.pointerId !== gesture.pointerId) return;
    gesture = undefined;
    stopTracking();
    if (frame !== 0) view.cancelAnimationFrame(frame);
    flush();
  };

  const tracking = [
    ['pointermove', onMove],
    ['pointerup', onEnd],
    ['pointercancel', onEnd],
    ['lostpointercapture', onEnd],
  ] as const;
  const stopTracking = () => {
    for (const [type, listener] of tracking) doc.removeEventListener(type, listener, true);
  };

  handle.addEventListener('pointerdown', onDown);
  return () => {
    handle.removeEventListener('pointerdown', onDown);
    stopTracking();
    if (frame !== 0) view.cancelAnimationFrame(frame);
  };
}
