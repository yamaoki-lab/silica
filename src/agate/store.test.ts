import { describe, expect, test, vi } from 'vitest';
import { CASCADE_STEP, MIN_VISIBLE_MARGIN } from './geometry.ts';
import { DEFAULT_CONTENT_HEIGHT, DEFAULT_CONTENT_WIDTH, WindowStore } from './store.ts';

const frame = { width: 2, height: 30 };
const container = { width: 1280, height: 720 };
const width = DEFAULT_CONTENT_WIDTH + frame.width;
const height = DEFAULT_CONTENT_HEIGHT + frame.height;

// 開いて, 測った枠の分で置く. view が描いた直後にすることと同じ.
function openAndPlace(store: WindowStore<number>, id: number, group: string) {
  store.open(id, group);
  const bounds = store.place(id, frame);
  if (bounds === undefined) throw new Error('置けなかった');
  return bounds;
}

describe('open', () => {
  test('置くまでは位置が無く, 一覧には既定の中身の大きさで載る', () => {
    const store = new WindowStore<number>(container);
    store.open(1, 'yamaoki.editor');
    expect(store.get(1)).toBeUndefined();
    expect(store.entries()).toEqual([{ id: 1, width: DEFAULT_CONTENT_WIDTH, height: DEFAULT_CONTENT_HEIGHT }]);
  });
});

describe('place', () => {
  test('既定の中身の大きさに枠を足し, 1枚目は領域の中央に置く', () => {
    const store = new WindowStore<number>(container);
    expect(openAndPlace(store, 1, 'yamaoki.editor')).toEqual({
      x: Math.round((container.width - width) / 2),
      y: Math.round((container.height - height) / 2),
      width,
      height,
    });
    expect(store.entries()).toEqual([{ id: 1, width, height }]);
  });

  test('同じ group の2枚目は右下へずらし, 別の group はまた中央に置く', () => {
    const store = new WindowStore<number>(container);
    const first = openAndPlace(store, 1, 'yamaoki.editor');
    expect(openAndPlace(store, 2, 'yamaoki.editor')).toMatchObject({ x: first.x + CASCADE_STEP, y: first.y + CASCADE_STEP });
    expect(openAndPlace(store, 3, 'yamaoki.viewer')).toMatchObject({ x: first.x, y: first.y });
  });

  test('領域より大きい時は領域に収める', () => {
    const store = new WindowStore<number>({ width: 390, height: 200 });
    expect(openAndPlace(store, 1, 'yamaoki.editor')).toEqual({ x: 0, y: 0, width: 390, height: 200 });
  });

  test('領域の大きさが小数でも整数で持つ', () => {
    const store = new WindowStore<number>({ width: 1000.5, height: 700.25 });
    const bounds = openAndPlace(store, 1, 'yamaoki.editor');
    expect(Object.values(bounds).every(Number.isInteger)).toBe(true);
  });

  test('一覧と位置の購読先を呼ぶ', () => {
    const store = new WindowStore<number>(container);
    store.open(1, 'yamaoki.editor');
    const onList = vi.fn();
    const onPosition = vi.fn();
    store.subscribe(onList);
    store.subscribePosition(1, onPosition);
    store.place(1, frame);
    expect(onList).toHaveBeenCalledTimes(1);
    expect(onPosition).toHaveBeenCalledTimes(1);
  });

  test('2回目は何もせず, 置いた矩形を返す', () => {
    const store = new WindowStore<number>(container);
    const first = openAndPlace(store, 1, 'yamaoki.editor');
    const listener = vi.fn();
    store.subscribe(listener);
    expect(store.place(1, { width: 10, height: 100 })).toEqual(first);
    expect(store.get(1)).toEqual(first);
    expect(listener).not.toHaveBeenCalled();
  });

  test('無いウインドウは何もしない', () => {
    const store = new WindowStore<number>(container);
    expect(store.place(1, frame)).toBeUndefined();
    expect(store.entries()).toEqual([]);
  });
});

describe('move', () => {
  test('行き先の位置を整数に丸めて持つ', () => {
    const store = new WindowStore<number>(container);
    openAndPlace(store, 1, 'yamaoki.editor');
    store.move(1, { x: 10.5, y: 20.4 });
    expect(store.get(1)).toMatchObject({ x: 11, y: 20 });
  });

  test('タイトルバーが領域の外へ出きらないよう位置を制限する', () => {
    const store = new WindowStore<number>(container);
    openAndPlace(store, 1, 'yamaoki.editor');
    store.move(1, { x: -10_000, y: -10_000 });
    expect(store.get(1)).toMatchObject({ x: -(width - MIN_VISIBLE_MARGIN), y: 0 });
    store.move(1, { x: 10_000, y: 10_000 });
    expect(store.get(1)).toMatchObject({
      x: container.width - MIN_VISIBLE_MARGIN,
      y: container.height - MIN_VISIBLE_MARGIN,
    });
  });

  test('位置の購読先を呼び, 一覧は作り直さない', () => {
    const store = new WindowStore<number>(container);
    openAndPlace(store, 1, 'yamaoki.editor');
    openAndPlace(store, 2, 'yamaoki.editor');
    const entries = store.entries();
    const onList = vi.fn();
    const onFirst = vi.fn();
    const onSecond = vi.fn();
    store.subscribe(onList);
    store.subscribePosition(1, onFirst);
    store.subscribePosition(2, onSecond);
    store.move(1, { x: 100, y: 100 });
    expect(onFirst).toHaveBeenCalledTimes(1);
    expect(onSecond).not.toHaveBeenCalled();
    expect(onList).not.toHaveBeenCalled();
    expect(store.entries()).toBe(entries);
  });

  test('位置が変わらなければ購読先を呼ばない', () => {
    const store = new WindowStore<number>(container);
    openAndPlace(store, 1, 'yamaoki.editor');
    store.move(1, { x: 100, y: 100 });
    const listener = vi.fn();
    store.subscribePosition(1, listener);
    store.move(1, { x: 100.2, y: 99.8 });
    expect(listener).not.toHaveBeenCalled();
  });

  test('無いウインドウと置く前のウインドウは何もしない', () => {
    const store = new WindowStore<number>(container);
    store.move(1, { x: 100, y: 100 });
    expect(store.get(1)).toBeUndefined();
    store.open(1, 'yamaoki.editor');
    store.move(1, { x: 100, y: 100 });
    expect(store.get(1)).toBeUndefined();
  });
});

describe('一覧', () => {
  test('開いた順に並べ, 開いた時と閉じた時に購読先を呼ぶ', () => {
    const store = new WindowStore<number>(container);
    const listener = vi.fn();
    store.subscribe(listener);
    store.open(2, 'yamaoki.editor');
    store.open(1, 'yamaoki.editor');
    expect(store.entries().map((entry) => entry.id)).toEqual([2, 1]);
    store.close(2);
    expect(store.entries().map((entry) => entry.id)).toEqual([1]);
    expect(listener).toHaveBeenCalledTimes(3);
  });

  test('無いウインドウを閉じても購読先を呼ばない', () => {
    const store = new WindowStore<number>(container);
    const listener = vi.fn();
    store.subscribe(listener);
    store.close(1);
    expect(listener).not.toHaveBeenCalled();
  });

  test('購読をやめると呼ばない', () => {
    const store = new WindowStore<number>(container);
    const listener = vi.fn();
    store.subscribe(listener)();
    store.open(1, 'yamaoki.editor');
    expect(listener).not.toHaveBeenCalled();
  });
});
