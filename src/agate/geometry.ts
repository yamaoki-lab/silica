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

/**
 * 1つの軸 (x か y) について, 領域の大きさが変わった時の置き直し後の位置を計算する.
 * ウインドウの両端がそれぞれの領域の端からどれだけ離れているかの比 r で,
 * ウインドウのどこを基準点にするかを連続的に決める
 * (0 は始端が領域の端に付いていて基準点は始端, 1 は終端が付いていて基準点は終端,
 * 0.5 は両端が等しく離れていて基準点は中心. その間は連続的に補う).
 * 基準点の領域に対する割合を保ったまま, 新しい領域の大きさに合わせて基準点を動かし,
 * そこから逆算してウインドウの位置を求める.
 *
 * ウインドウが領域からはみ出している時に, 隠れている部分の座標をそのまま使うと,
 * 領域が広がった時にその座標まで拡大されてさらに奥へ飛んでいく.
 * そのため基準点は領域の中に見えている範囲だけから決める (はみ出た側は領域の端に
 * 付いているとみなす). 隠れている分 (ウインドウの始端から基準点までの距離) は保ったまま,
 * 新しい領域での基準点の位置から逆算する.
 */
function computeAxisReposition(
  start: number,
  size: number,
  oldContainerSize: number,
  newContainerSize: number,
): number {
  const visibleStart = Math.min(Math.max(start, 0), oldContainerSize);
  const visibleEnd = Math.min(Math.max(start + size, 0), oldContainerSize);
  const visibleSize = visibleEnd - visibleStart;
  const startGap = visibleStart;
  const endGap = oldContainerSize - visibleEnd;
  const totalGap = startGap + endGap;
  const r = totalGap > 0 ? Math.min(1, Math.max(0, startGap / totalGap)) : 0.5;
  const anchorOld = visibleStart + r * visibleSize;
  const anchorOffset = anchorOld - start;
  const anchorNew = (anchorOld / oldContainerSize) * newContainerSize;
  return anchorNew - anchorOffset;
}

// ブラウザのウインドウのリサイズ等で領域の大きさが変わった時に, 各ウインドウを
// 自身の基準点を保ったまま相対的に動かした位置を計算する (大きさは変えない).
export function computeProportionalReposition(
  win: Bounds,
  oldContainer: ContainerSize,
  newContainer: ContainerSize,
): { x: number; y: number } {
  if (oldContainer.width <= 0 || oldContainer.height <= 0) {
    return { x: win.x, y: win.y };
  }
  return {
    x: computeAxisReposition(win.x, win.width, oldContainer.width, newContainer.width),
    y: computeAxisReposition(win.y, win.height, oldContainer.height, newContainer.height),
  };
}

export type TilePosition = 'left' | 'right' | 'top' | 'bottom' | 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';

// ウインドウを置く領域を2分割か4分割した位置に, ちょうど収まる bounds を計算する.
// 大きさが奇数の時は, 余りの 1px を右と下に寄せ, 間に隙間を空けない.
export function computeTiledBounds(position: TilePosition, container: ContainerSize): Bounds {
  const leftWidth = Math.floor(container.width / 2);
  const topHeight = Math.floor(container.height / 2);
  const rightWidth = container.width - leftWidth;
  const bottomHeight = container.height - topHeight;
  switch (position) {
    case 'left':
      return { x: 0, y: 0, width: leftWidth, height: container.height };
    case 'right':
      return { x: leftWidth, y: 0, width: rightWidth, height: container.height };
    case 'top':
      return { x: 0, y: 0, width: container.width, height: topHeight };
    case 'bottom':
      return { x: 0, y: topHeight, width: container.width, height: bottomHeight };
    case 'top-left':
      return { x: 0, y: 0, width: leftWidth, height: topHeight };
    case 'top-right':
      return { x: leftWidth, y: 0, width: rightWidth, height: topHeight };
    case 'bottom-left':
      return { x: 0, y: topHeight, width: leftWidth, height: bottomHeight };
    case 'bottom-right':
      return { x: leftWidth, y: topHeight, width: rightWidth, height: bottomHeight };
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
