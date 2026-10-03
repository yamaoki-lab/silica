import type { Bounds, ContainerSize, ResizeEdge } from './types.ts';

// ウインドウ (タイトルバーを含む全体) の既定の最小の大きさ. アプリケーションごとに変えられる.
export const MIN_WINDOW_WIDTH = 200;
export const MIN_WINDOW_HEIGHT = 120;

// タイトルバーが領域の外へ出きって掴めなくなるのを防ぐため, 移動の時に
// 最低でもこの幅と高さの分は領域の中に残す.
export const MIN_VISIBLE_MARGIN = 40;

/**
 * ドラッグを始めた時の bounds と, そこからの累積の移動量から, 新しい bounds を計算する.
 * 今の (切り詰め済みかもしれない) 状態に差分を積むと, 最小の大きさに達した後で
 * ポインタが行き過ぎた分が失われ, 逆向きへの反応が早すぎて不自然になる.
 * そのため常に始めた時の bounds から計算し直す.
 */
export function computeResizedBounds(
  start: Bounds,
  edge: ResizeEdge,
  totalDx: number,
  totalDy: number,
  // アプリケーションごとに最小の大きさを変える時に使う.
  minWidth: number = MIN_WINDOW_WIDTH,
  minHeight: number = MIN_WINDOW_HEIGHT,
): Bounds {
  let { x, y, width, height } = start;
  if (edge.includes('e')) {
    width = Math.max(minWidth, start.width + totalDx);
  }
  if (edge.includes('s')) {
    height = Math.max(minHeight, start.height + totalDy);
  }
  if (edge.includes('w')) {
    const newWidth = Math.max(minWidth, start.width - totalDx);
    x = start.x + (start.width - newWidth);
    width = newWidth;
  }
  if (edge.includes('n')) {
    const newHeight = Math.max(minHeight, start.height - totalDy);
    y = start.y + (start.height - newHeight);
    height = newHeight;
  }
  return { x, y, width, height };
}

/**
 * ドラッグを始めた時の位置と, そこからの累積の移動量から, 新しい位置を計算する
 * (リサイズと同じ理由で, 始めた時の位置から計算し直す).
 * タイトルバーの一部が常に領域の中に残るように切り詰める.
 */
export function computeMovedPosition(
  start: { x: number; y: number },
  windowWidth: number,
  container: ContainerSize,
  totalDx: number,
  totalDy: number,
): { x: number; y: number } {
  const minX = -(windowWidth - MIN_VISIBLE_MARGIN);
  const maxX = container.width - MIN_VISIBLE_MARGIN;
  const minY = 0;
  const maxY = container.height - MIN_VISIBLE_MARGIN;
  const x = Math.min(maxX, Math.max(minX, start.x + totalDx));
  const y = Math.min(maxY, Math.max(minY, start.y + totalDy));
  return { x, y };
}

export type TilePosition = 'left' | 'right' | 'top' | 'bottom' | 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';

// ウインドウを置く領域を2分割か4分割した位置に, ちょうど収まる bounds を計算する.
export function computeTiledBounds(position: TilePosition, container: ContainerSize): Bounds {
  const halfWidth = Math.floor(container.width / 2);
  const halfHeight = Math.floor(container.height / 2);
  switch (position) {
    case 'left':
      return { x: 0, y: 0, width: halfWidth, height: container.height };
    case 'right':
      return { x: container.width - halfWidth, y: 0, width: halfWidth, height: container.height };
    case 'top':
      return { x: 0, y: 0, width: container.width, height: halfHeight };
    case 'bottom':
      return { x: 0, y: container.height - halfHeight, width: container.width, height: halfHeight };
    case 'top-left':
      return { x: 0, y: 0, width: halfWidth, height: halfHeight };
    case 'top-right':
      return { x: container.width - halfWidth, y: 0, width: halfWidth, height: halfHeight };
    case 'bottom-left':
      return { x: 0, y: container.height - halfHeight, width: halfWidth, height: halfHeight };
    case 'bottom-right':
      return { x: container.width - halfWidth, y: container.height - halfHeight, width: halfWidth, height: halfHeight };
  }
}

// 中央に置く. 大きさはそのままで, 領域の中央に来る位置を計算する.
// ウインドウが領域より大きい時に単に中央に合わせると, タイトルバーが
// メニューバーの裏や領域の外に出てしまうので, ドラッグと同じ切り詰めを重ねる.
export function computeCenteredPosition(
  size: { width: number; height: number },
  container: ContainerSize,
): { x: number; y: number } {
  const raw = { x: (container.width - size.width) / 2, y: (container.height - size.height) / 2 };
  return computeMovedPosition(raw, size.width, container, 0, 0);
}
