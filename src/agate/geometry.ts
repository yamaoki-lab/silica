import type { Bounds, ContainerSize, ResizeEdge } from './types.ts';

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
  // アプリケーションごとに, より大きい最小の大きさを指定する時に使う.
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
