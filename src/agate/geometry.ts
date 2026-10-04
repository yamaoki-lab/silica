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

// 少しずつ右下へずらして重ねるカスケードの間隔.
// ウインドウの整理と, 新しいウインドウを開く位置の両方で使う.
export const CASCADE_STEP = 32;

// カスケードで並べるウインドウ. 並べる順と位置の計算に使う分だけを持つ.
export interface CascadeWindow {
  id: string;
  zIndex: number;
  width: number;
  height: number;
}

// ウインドウの整理 (⌥ を押しながら全てを手前に移動) で使う, 領域の中央を基準にした
// カスケード (グリッドではない). 最も手前 (zIndex が最大) のウインドウは上に何も
// 重ならないので最も右下に, 最も奥のウインドウが最も左上に来るように並べる
// (逆にすると, 手前のウインドウの本体が奥のウインドウのタイトルバーを覆って隠すため).
// 全体は中央に置く.
export function computeCascadeBounds(
  windows: CascadeWindow[],
  container: ContainerSize,
): Map<string, { x: number; y: number }> {
  const ordered = [...windows].sort((a, b) => b.zIndex - a.zIndex);
  const n = ordered.length;
  const result = new Map<string, { x: number; y: number }>();
  if (n === 0) {
    return result;
  }
  const maxWidth = Math.max(...ordered.map((w) => w.width));
  const maxHeight = Math.max(...ordered.map((w) => w.height));
  const groupWidth = maxWidth + (n - 1) * CASCADE_STEP;
  const groupHeight = maxHeight + (n - 1) * CASCADE_STEP;
  // 全体が領域より大きい時に単に中央に合わせると負になり, 先頭のウインドウが
  // メニューバーの裏や領域の外に出てしまう. そのため上端と左端より外には出さない
  // (収まらない分は右と下へはみ出させる).
  const originX = Math.max(0, (container.width - groupWidth) / 2);
  const originY = Math.max(0, (container.height - groupHeight) / 2);
  ordered.forEach((w, i) => {
    // i = 0 が最も手前. ずらす量は奥のウインドウ (i が大きいほど奥) ほど
    // 小さくなるよう逆順にする.
    const step = n - 1 - i;
    const { x, y } = computeMovedPosition(
      { x: originX + step * CASCADE_STEP, y: originY + step * CASCADE_STEP },
      w.width,
      container,
      0,
      0,
    );
    result.set(w.id, { x, y });
  });
  return result;
}

// 周回する (右端に達して左上へ戻る) たびに, 再び始める位置をこの分だけずらす.
// 毎回同じ位置から始めると, 1周目と2周目以降が完全に重なってしまうため.
const LAP_OFFSET = CASCADE_STEP / 2;

// 同じアプリケーションの2つ目以降のウインドウを開く位置. 直前に開いた位置から
// 右下へ CASCADE_STEP の分ずらす. 右端に寄りすぎてタイトルバーを掴めなくなりそうな
// 時は, そのアプリケーションの既定の位置 (defaultPosition, 1つ目のウインドウの位置)
// まで戻ってカスケードをやり直す (周回のたびに LAP_OFFSET の分ずらした位置から
// 始めるので, 前の周と重ならない). 縦は右端のような判定に使わないので,
// 念のため最後にドラッグと同じ切り詰めを重ねる.
export function computeNextOpenPosition(
  lastPosition: { x: number; y: number },
  defaultPosition: { x: number; y: number },
  size: { width: number; height: number },
  container: ContainerSize,
  lap: number,
): { position: { x: number; y: number }; lap: number } {
  const next = { x: lastPosition.x + CASCADE_STEP, y: lastPosition.y + CASCADE_STEP };
  const reachedRightEdge = next.x > container.width - MIN_VISIBLE_MARGIN;
  const nextLap = reachedRightEdge ? lap + 1 : lap;
  const raw = reachedRightEdge
    ? { x: defaultPosition.x + nextLap * LAP_OFFSET, y: defaultPosition.y + nextLap * LAP_OFFSET }
    : next;
  const position = computeMovedPosition(raw, size.width, container, 0, 0);
  return { position, lap: nextLap };
}
