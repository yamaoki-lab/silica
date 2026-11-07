// タイトルバーの要素にドラッグを付ける. 判定は DragGesture に任せ, ここはイベントの登録と解除と, ストアへの書き込みを持つ.
import type { WindowStore } from '../agate/store.ts';
import { DragGesture } from './drag.ts';

type Point = { x: number; y: number };

// 返した関数で外す.
export function attachWindowDrag<Id>(handle: HTMLElement, store: WindowStore<Id>, id: Id): () => void {
  const view = handle.ownerDocument.defaultView;
  if (view === null) return () => {};
  let gesture: DragGesture | undefined;
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

  const onDown = (event: PointerEvent) => {
    if (gesture !== undefined) return;
    const bounds = store.get(id);
    const next = DragGesture.begin(event);
    if (bounds === undefined || next === undefined) return;
    gesture = next;
    start = { x: bounds.x, y: bounds.y };
    handle.setPointerCapture(event.pointerId);
  };

  const onMove = (event: PointerEvent) => {
    if (gesture === undefined || event.pointerId !== gesture.pointerId) return;
    const delta = gesture.update(event);
    if (delta === undefined) return;
    pending = { x: start.x + delta.x, y: start.y + delta.y };
    if (frame === 0) frame = view.requestAnimationFrame(flush);
  };

  // 離した時も, 途切れた時 (pointercancel, lostpointercapture) も, 残りを先に当ててその位置で終える.
  const onEnd = (event: PointerEvent) => {
    if (gesture === undefined || event.pointerId !== gesture.pointerId) return;
    gesture = undefined;
    if (frame !== 0) view.cancelAnimationFrame(frame);
    flush();
  };

  const listeners = [
    ['pointerdown', onDown],
    ['pointermove', onMove],
    ['pointerup', onEnd],
    ['pointercancel', onEnd],
    ['lostpointercapture', onEnd],
  ] as const;
  for (const [type, listener] of listeners) handle.addEventListener(type, listener);
  return () => {
    for (const [type, listener] of listeners) handle.removeEventListener(type, listener);
    if (frame !== 0) view.cancelAnimationFrame(frame);
  };
}
