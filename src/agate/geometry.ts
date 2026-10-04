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

// 少しずつ右下へずらして重ねるカスケードの間隔の既定の値.
// ウインドウの整理と, 新しいウインドウを開く位置の両方で使う. 後ろのウインドウの
// タイトルバーがちょうど見える量が自然なので, タイトルバーの太さが分かる側
// (描いて測る view と, それを持つ核) が step で差し替える.
export const CASCADE_STEP = 29;

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
  { step = CASCADE_STEP }: { step?: number } = {},
): Map<string, { x: number; y: number }> {
  const ordered = [...windows].sort((a, b) => b.zIndex - a.zIndex);
  const n = ordered.length;
  const result = new Map<string, { x: number; y: number }>();
  if (n === 0) {
    return result;
  }
  const maxWidth = Math.max(...ordered.map((w) => w.width));
  const maxHeight = Math.max(...ordered.map((w) => w.height));
  const groupWidth = maxWidth + (n - 1) * step;
  const groupHeight = maxHeight + (n - 1) * step;
  // 全体が領域より大きい時に単に中央に合わせると負になり, 先頭のウインドウが
  // メニューバーの裏や領域の外に出てしまう. そのため上端と左端より外には出さない
  // (収まらない分は右と下へはみ出させる).
  const originX = Math.max(0, (container.width - groupWidth) / 2);
  const originY = Math.max(0, (container.height - groupHeight) / 2);
  ordered.forEach((w, i) => {
    // i = 0 が最も手前. ずらす回数は奥のウインドウ (i が大きいほど奥) ほど
    // 少なくなるよう逆順にする.
    const rank = n - 1 - i;
    const { x, y } = computeMovedPosition(
      { x: originX + rank * step, y: originY + rank * step },
      w.width,
      container,
      0,
      0,
    );
    result.set(w.id, { x, y });
  });
  return result;
}

// 折り返す (端に達して始めの側へ戻る) たびに, 戻る位置をずらす量.
// 毎回同じ位置へ戻ると, 1周目と2周目以降が完全に重なってしまうため.
// 決まった値か, 間隔を受けて値を返す関数で渡す. 小数は戻る位置を計算する時に切り捨てる.
export type LapOffset = number | ((step: number) => number);

// 間隔の半分. 次の周が前の周のちょうど間に並ぶ.
// 間隔が偶数だと, 2周で1歩分ずれた同じ列に戻るので, 早めに前の周と重なる.
export function halfLapOffset(step: number): number {
  return step / 2;
}

// 黄金比で分けた短い方 (間隔の約 0.38 倍) に近い, 間隔と公約数を持たない整数.
// 周を重ねても戻る位置が最も均等に散らばり, 前の周と重なりにくい.
// 次の周は前の周の間の 4 割ほどの所に並ぶ.
export function goldenLapOffset(step: number): number {
  const whole = Math.round(step);
  let offset = Math.max(1, Math.round(whole * (1 - 2 / (1 + Math.sqrt(5)))));
  while (greatestCommonDivisor(offset, whole) !== 1) {
    offset += 1;
  }
  return offset;
}

function greatestCommonDivisor(a: number, b: number): number {
  return b === 0 ? a : greatestCommonDivisor(b, a % b);
}

// 1つの軸について, 次に開く位置と, その軸で折り返した回数を計算する.
// ずらした先でウインドウが領域からはみ出すなら, 既定の位置から折り返した回数の分
// ずらした位置へ戻る. 戻る位置でもはみ出すなら, 領域の端へ戻り, 数え直す.
function computeNextAxisPosition(
  last: number,
  defaultStart: number,
  size: number,
  containerSize: number,
  lap: number,
  step: number,
  lapOffset: number,
): { start: number; lap: number } {
  const next = last + step;
  if (next + size <= containerSize) {
    return { start: next, lap };
  }
  const wrapped = defaultStart + Math.floor((lap + 1) * lapOffset);
  if (wrapped + size <= containerSize) {
    return { start: wrapped, lap: lap + 1 };
  }
  return { start: 0, lap: 0 };
}

// 同じアプリケーションの2つ目以降のウインドウを開く位置. 直前に開いた位置から
// 右下へ step の分ずらす. 右端や下端からはみ出す時は, はみ出す軸だけを
// そのアプリケーションの既定の位置 (defaultPosition, 1つ目のウインドウの位置) の側へ戻す.
// 軸ごとに別々に折り返し, 戻る位置も軸ごとに lapOffset ずつずらすので,
// 端に貼り付かず, 周ごとに違う斜めの列に並ぶ. 領域より大きいウインドウのために,
// 最後にドラッグと同じ切り詰めを重ねる.
export function computeNextOpenPosition(
  lastPosition: { x: number; y: number },
  defaultPosition: { x: number; y: number },
  size: { width: number; height: number },
  container: ContainerSize,
  laps: { x: number; y: number },
  { step = CASCADE_STEP, lapOffset = halfLapOffset }: { step?: number; lapOffset?: LapOffset } = {},
): { position: { x: number; y: number }; laps: { x: number; y: number } } {
  const offset = typeof lapOffset === 'number' ? lapOffset : lapOffset(step);
  const x = computeNextAxisPosition(lastPosition.x, defaultPosition.x, size.width, container.width, laps.x, step, offset);
  const y = computeNextAxisPosition(lastPosition.y, defaultPosition.y, size.height, container.height, laps.y, step, offset);
  const position = computeMovedPosition({ x: x.start, y: y.start }, size.width, container, 0, 0);
  return { position, laps: { x: x.lap, y: y.lap } };
}
