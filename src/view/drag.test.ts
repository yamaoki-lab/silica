import { describe, expect, test } from 'vitest';
import { DragGesture } from './drag.ts';
import { DRAG_SLOP, type InputKind } from './input.ts';

const press = (overrides: Partial<PointerEvent> = {}) => ({
  isPrimary: true,
  button: 0,
  pointerId: 1,
  pointerType: 'mouse',
  clientX: 100,
  clientY: 100,
  ...overrides,
});

describe('begin', () => {
  test('最初のポインタの主ボタンでドラッグを始める', () => {
    expect(DragGesture.begin(press())).toBeInstanceOf(DragGesture);
  });

  test.for([
    ['2本目の指', { isPrimary: false, pointerType: 'touch' }],
    ['右のボタン', { button: 2 }],
    ['ペンのサイドスイッチ', { button: 2, pointerType: 'pen' }],
    ['ペンの消しゴム', { button: 5, pointerType: 'pen' }],
  ] as const)('%s ではドラッグを始めない', ([, overrides]) => {
    expect(DragGesture.begin(press(overrides))).toBeUndefined();
  });
});

describe('update', () => {
  test.for([
    ['mouse', 4],
    ['pen', 6],
    ['touch', 8],
  ] as const)('%s は %d px までは動かさない', ([pointerType, slop]: readonly [InputKind, number]) => {
    expect(DRAG_SLOP[pointerType]).toBe(slop);
    const gesture = DragGesture.begin(press({ pointerType }))!;
    expect(gesture.update({ clientX: 100 + slop, clientY: 100 })).toBeUndefined();
    expect(gesture.update({ clientX: 100 + slop + 1, clientY: 100 })).toEqual({ x: slop + 1, y: 0 });
  });

  test('遊びは押した点からの距離で見る', () => {
    const gesture = DragGesture.begin(press())!;
    // 軸ごとには 4 以下だが, 距離は 4 を超える.
    expect(gesture.update({ clientX: 103, clientY: 103 })).toEqual({ x: 3, y: 3 });
  });

  test('知らない種類はマウスとして扱う', () => {
    const gesture = DragGesture.begin(press({ pointerType: '' }))!;
    expect(gesture.update({ clientX: 104, clientY: 100 })).toBeUndefined();
    expect(gesture.update({ clientX: 105, clientY: 100 })).toEqual({ x: 5, y: 0 });
  });

  test('動き始めた後は, 押した点の近くへ戻っても動かす', () => {
    const gesture = DragGesture.begin(press())!;
    gesture.update({ clientX: 120, clientY: 100 });
    expect(gesture.update({ clientX: 101, clientY: 100 })).toEqual({ x: 1, y: 0 });
  });
});
