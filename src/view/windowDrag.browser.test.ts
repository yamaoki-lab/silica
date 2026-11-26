import { beforeAll, expect, test } from 'vitest';
import { commands, server, userEvent } from 'vitest/browser';
import type { MouseStep, PointerInput } from '../../vitest.config.ts';
import { openTestWindow } from '../testdata/openTestWindow.ts';

declare module 'vitest/browser' {
  interface BrowserCommands {
    mouse: (steps: MouseStep[]) => Promise<void>;
    pointer: (input: PointerInput, steps: MouseStep[]) => Promise<void>;
  }
}

// mount で開いた実際のウインドウ. 各テストでこれを共有し, どれだけ移動したかを調べる.
let titleBar: HTMLElement;
let title: Element;

beforeAll(async () => {
  titleBar = await openTestWindow('タイトル');
  title = titleBar.firstElementChild!;
});

const centerOf = (element: Element) => {
  const rect = element.getBoundingClientRect();
  return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
};

type Point = { x: number; y: number };

// 要素の中央を押し, 遊びを超えるよう少しずつ右に 50 px, 下に 30 px 動かしてから離す. 入力はマウス, またはペンか指.
// pointerdown から pointerup までの間にポインタがどれだけ動いたかを, ページが受け取った値として返す.
// ブラウザがマウスの位置を丸めることがあるため (WebKit は画面の整数ピクセル単位で動かす), 50 や 30 からわずかにずれることがある.
// 押した時にページが受け取ったイベントも返す.
const dragFrom = async (element: Element, input?: PointerInput): Promise<Point & { pressed: PointerEvent }> => {
  const from = centerOf(element);
  let down: PointerEvent | undefined;
  let up: Point | undefined;
  const onDown = (event: PointerEvent) => (down ??= event);
  const onUp = (event: PointerEvent) => (up = { x: event.clientX, y: event.clientY });
  document.addEventListener('pointerdown', onDown, true);
  document.addEventListener('pointerup', onUp, true);
  const steps: MouseStep[] = [
    { type: 'move', x: from.x, y: from.y },
    { type: 'down' },
    { type: 'move', x: from.x + 50, y: from.y + 30, steps: 10 },
    { type: 'up' },
  ];
  try {
    await (input === undefined ? commands.mouse(steps) : commands.pointer(input, steps));
  } finally {
    document.removeEventListener('pointerdown', onDown, true);
    document.removeEventListener('pointerup', onUp, true);
  }
  if (down === undefined || up === undefined) throw new Error('ページが pointerdown と pointerup を受け取らなかった');
  return { x: up.x - down.clientX, y: up.y - down.clientY, pressed: down };
};

// 位置の書き込みは 1 フレームにつき最大 1 回なので, 読み取る前に次のフレームまで待つ.
const nextFrame = () => new Promise((resolve) => requestAnimationFrame(resolve));

const position = () => {
  const rect = titleBar.getBoundingClientRect();
  return { x: rect.left, y: rect.top };
};

// タイトルバーにはまだボタンがないため (閉じるボタンは #14 で入る), #15 の計画どおりボタンが配置される場所に 1 つ追加する.
const withButton = async (run: (button: HTMLButtonElement, clicks: () => number) => Promise<void>) => {
  const button = document.createElement('button');
  button.textContent = 'X';
  let clicks = 0;
  button.addEventListener('click', () => clicks++);
  titleBar.prepend(button);
  try {
    await run(button, () => clicks);
  } finally {
    button.remove();
  }
};

test('タイトルからのドラッグでウインドウが動く', async () => {
  const before = position();
  const moved = await dragFrom(title);
  await nextFrame();
  // ウインドウはポインタに追従する. その位置は整数ピクセルに丸められる.
  expect(position()).toEqual({ x: before.x + Math.round(moved.x), y: before.y + Math.round(moved.y) });
});

// ペンと指は Chrome DevTools Protocol で送るため, Chromium でのみ試す (#45).
// 筆圧と傾きがページに届き, マウスと同様にウインドウがポインタに追従することを確かめる.
for (const type of ['pen', 'touch'] as const) {
  test.runIf(server.browser === 'chromium')(`タイトルからの${type === 'pen' ? 'ペン' : '指'}のドラッグでウインドウが動く`, async () => {
    const before = position();
    const moved = await dragFrom(title, { type, pressure: 0.5, tiltX: 30, tiltY: -20 });
    await nextFrame();
    const { pointerType, pressure, tiltX, tiltY } = moved.pressed;
    expect({ pointerType, pressure, tiltX, tiltY }).toEqual({ pointerType: type, pressure: 0.5, tiltX: 30, tiltY: -20 });
    expect(position()).toEqual({ x: before.x + Math.round(moved.x), y: before.y + Math.round(moved.y) });
  });
}

test('タイトルバーのボタンをクリックするとボタンに届く', async () => {
  await withButton(async (button, clicks) => {
    const before = position();
    await userEvent.click(button);
    expect(clicks()).toBe(1);
    expect(position()).toEqual(before);
  });
});

test('タイトルバーのボタンからのドラッグではウインドウが動かない', async () => {
  await withButton(async (button) => {
    const before = position();
    await dragFrom(button);
    await nextFrame();
    expect(position()).toEqual(before);
  });
});
