// ウインドウの矩形 (位置と大きさ) を持つ小さなストア. ウインドウがあるか, タイトル, 所有者はセッションが持ち,
// view が id で突き合わせて描く. 毎フレーム変わる位置はここだけに持ち, ドラッグの間もセッションには送らない.
import { computeCenteredPosition, computeFittedSize, computeMovedPosition, computeNextOpenPosition } from './geometry.ts';
import type { Bounds, ContainerSize, FrameExtent } from './types.ts';

// 希望サイズの無いウインドウの, 中身の大きさ. 希望サイズ (#4) が入れば, ほとんどのウインドウはそちらで決まる.
export const DEFAULT_CONTENT_WIDTH = 480;
export const DEFAULT_CONTENT_HEIGHT = 270;

// 一覧に載せる1枚. 位置はドラッグの間に毎フレーム変わるので入れず, get と subscribePosition で読む.
// 置く前は既定の中身の大きさを入れる. view はこの大きさで描いて枠の分を測る.
export interface WindowEntry<Id> {
  readonly id: Id;
  readonly width: number;
  readonly height: number;
}

type Point = { x: number; y: number };

interface WindowRecord {
  // 開く位置をずらす単位. 置く時に使う.
  readonly group: string;
  // 中身の周りに付くもの (枠とタイトルバー) の大きさ. 見た目が決めるので, view が描いて測り place で渡す.
  frame: FrameExtent | undefined;
  // 置くまでは無い.
  bounds: Bounds | undefined;
}

// 開く位置をずらすための, アプリケーションごとの記録. computeNextOpenPosition を参照.
interface Cascade {
  defaultPosition: Point;
  lastPosition: Point;
  laps: Point;
}

export class WindowStore<Id> {
  // 開いた順に並べて持つ. 手前に出す時は末尾へ移すだけにする (重なりは z-index で表し, DOM の順は動かさない).
  readonly #windows = new Map<Id, WindowRecord>();
  readonly #cascades = new Map<string, Cascade>();
  readonly #listeners = new Set<() => void>();
  readonly #positionListeners = new Map<Id, Set<() => void>>();
  #container: ContainerSize;
  #entries: readonly WindowEntry<Id>[] = [];

  constructor(container: ContainerSize) {
    this.#container = container;
  }

  // ウインドウを一覧に追加する. group は開く位置をずらす単位で, アプリケーションの id を渡す.
  // 枠の分は描いて測るまで分からないので, ここでは置かず, view が測って place を呼ぶ.
  open(id: Id, group: string): void {
    if (this.#windows.has(id)) return;
    this.#windows.set(id, { group, frame: undefined, bounds: undefined });
    this.#changed();
  }

  // 測った枠の分を受け, 既定の中身の大きさに足してウインドウを置く. 置いた矩形を返す.
  // 1枚目は領域の中央に置き, 2枚目からは同じ group の直前に置いた位置から右下へずらす.
  // 置くのは1回だけで, 2回目からは何もしない (文字の大きさの設定の変化を追うのは後).
  place(id: Id, frame: FrameExtent): Bounds | undefined {
    const record = this.#windows.get(id);
    if (record === undefined || record.bounds !== undefined) return record?.bounds;
    const size = roundSize(
      computeFittedSize(
        { width: DEFAULT_CONTENT_WIDTH, height: DEFAULT_CONTENT_HEIGHT },
        frame,
        { width: DEFAULT_CONTENT_WIDTH + frame.width, height: DEFAULT_CONTENT_HEIGHT + frame.height },
        this.#container,
      ),
    );
    const group = record.group;
    const cascade = this.#cascades.get(group);
    let position: Point;
    if (cascade === undefined) {
      position = roundPoint(computeCenteredPosition(size, this.#container));
      this.#cascades.set(group, { defaultPosition: position, lastPosition: position, laps: { x: 0, y: 0 } });
    } else {
      const next = computeNextOpenPosition(cascade.lastPosition, cascade.defaultPosition, size, this.#container, cascade.laps);
      position = roundPoint(next.position);
      cascade.lastPosition = position;
      cascade.laps = next.laps;
    }
    const bounds = { ...position, ...size };
    record.frame = frame;
    record.bounds = bounds;
    this.#changed();
    this.#positionChanged(id);
    return bounds;
  }

  close(id: Id): void {
    if (!this.#windows.delete(id)) return;
    this.#positionListeners.delete(id);
    this.#changed();
  }

  // ウインドウを動かす操作は全てここを通す (ドラッグも, 後のキーボードやコマンドも).
  // 行き先の位置を受け, タイトルバーが領域の外へ出きらないよう位置を制限してから, 整数に丸める. 置く前は何もしない.
  move(id: Id, target: Point): void {
    const record = this.#windows.get(id);
    const bounds = record?.bounds;
    if (record === undefined || bounds === undefined) return;
    const position = roundPoint(computeMovedPosition(target, bounds.width, this.#container, 0, 0));
    if (position.x === bounds.x && position.y === bounds.y) return;
    record.bounds = { ...bounds, ...position };
    this.#positionChanged(id);
  }

  // 領域の大きさを変える. 縮んだ時の置き直しは後で追加する.
  setContainer(container: ContainerSize): void {
    this.#container = container;
  }

  // 置く前は undefined を返す.
  get(id: Id): Bounds | undefined {
    return this.#windows.get(id)?.bounds;
  }

  // 開いた順の一覧. 開いた時, 置いた時, 閉じた時だけ新しい配列になる (useSyncExternalStore の getSnapshot に渡せる).
  entries(): readonly WindowEntry<Id>[] {
    return this.#entries;
  }

  // 一覧の変化を購読する. 返した関数で止める.
  subscribe(listener: () => void): () => void {
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  }

  // 1枚の位置の変化を購読する. view は React を通さず, ここから要素の transform を書く.
  subscribePosition(id: Id, listener: () => void): () => void {
    let listeners = this.#positionListeners.get(id);
    if (listeners === undefined) {
      listeners = new Set();
      this.#positionListeners.set(id, listeners);
    }
    listeners.add(listener);
    return () => listeners.delete(listener);
  }

  #changed(): void {
    this.#entries = [...this.#windows].map(([id, { bounds }]) => ({
      id,
      width: bounds?.width ?? DEFAULT_CONTENT_WIDTH,
      height: bounds?.height ?? DEFAULT_CONTENT_HEIGHT,
    }));
    for (const listener of this.#listeners) listener();
  }

  #positionChanged(id: Id): void {
    for (const listener of this.#positionListeners.get(id) ?? []) listener();
  }
}

// 位置と大きさは常に整数で持つ. 小数の位置は文字がにじみ, 置いた後に見かけと記録がずれる元になる.
function roundPoint({ x, y }: Point): Point {
  return { x: Math.round(x), y: Math.round(y) };
}

function roundSize({ width, height }: { width: number; height: number }): { width: number; height: number } {
  return { width: Math.round(width), height: Math.round(height) };
}
