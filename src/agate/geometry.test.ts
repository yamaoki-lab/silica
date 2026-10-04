// 場面は testdata/geometry/ の JSON に, 名前と入力と期待する結果の組で書く. ここでは流すだけにする.
import { describe, expect, test } from 'vitest';
import {
  type CascadeWindow,
  computeCascadeBounds,
  computeCenteredPosition,
  computeMovedPosition,
  computeNextOpenPosition,
  computeProportionalReposition,
  computeResizedBounds,
  computeTiledBounds,
  goldenLapOffset,
  halfLapOffset,
  type TilePosition,
} from './geometry.ts';
import type { Bounds, ContainerSize, ResizeEdge } from './types.ts';
import cascadeBoundsCases from './testdata/geometry/computeCascadeBounds.json' with { type: 'json' };
import centeredPositionCases from './testdata/geometry/computeCenteredPosition.json' with { type: 'json' };
import movedPositionCases from './testdata/geometry/computeMovedPosition.json' with { type: 'json' };
import nextOpenPositionCases from './testdata/geometry/computeNextOpenPosition.json' with { type: 'json' };
import proportionalRepositionCases from './testdata/geometry/computeProportionalReposition.json' with { type: 'json' };
import resizedBoundsCases from './testdata/geometry/computeResizedBounds.json' with { type: 'json' };
import tiledBoundsCases from './testdata/geometry/computeTiledBounds.json' with { type: 'json' };
import lapOffsetCases from './testdata/geometry/lapOffset.json' with { type: 'json' };

interface Case<Input, Expected> {
  name: string;
  input: Input;
  expected: Expected;
}

type Point = { x: number; y: number };

// 関数は JSON に書けないので, 組み込みのずれの関数は名前で書き, ここで関数に戻す.
const lapOffsets = { halfLapOffset, goldenLapOffset };
type LapOffsetName = keyof typeof lapOffsets;

describe('computeResizedBounds', () => {
  type Input = { start: Bounds; edge: ResizeEdge; totalDx: number; totalDy: number; minWidth?: number; minHeight?: number };
  test.for(resizedBoundsCases as Case<Input, Bounds>[])('$name', ({ input, expected }) => {
    const { start, edge, totalDx, totalDy, minWidth, minHeight } = input;
    expect(computeResizedBounds(start, edge, totalDx, totalDy, minWidth, minHeight)).toEqual(expected);
  });
});

describe('computeMovedPosition', () => {
  type Input = { start: Point; windowWidth: number; container: ContainerSize; totalDx: number; totalDy: number };
  test.for(movedPositionCases as Case<Input, Point>[])('$name', ({ input, expected }) => {
    const { start, windowWidth, container, totalDx, totalDy } = input;
    expect(computeMovedPosition(start, windowWidth, container, totalDx, totalDy)).toEqual(expected);
  });
});

describe('computeProportionalReposition', () => {
  type Input = { win: Bounds; oldContainer: ContainerSize; newContainer: ContainerSize };
  test.for(proportionalRepositionCases as Case<Input, Point>[])('$name', ({ input, expected }) => {
    expect(computeProportionalReposition(input.win, input.oldContainer, input.newContainer)).toEqual(expected);
  });
});

describe('computeTiledBounds', () => {
  type Input = { position: TilePosition; container: ContainerSize };
  test.for(tiledBoundsCases as Case<Input, Bounds>[])('$name', ({ input, expected }) => {
    expect(computeTiledBounds(input.position, input.container)).toEqual(expected);
  });
});

describe('computeCenteredPosition', () => {
  type Input = { size: { width: number; height: number }; container: ContainerSize };
  test.for(centeredPositionCases as Case<Input, Point>[])('$name', ({ input, expected }) => {
    expect(computeCenteredPosition(input.size, input.container)).toEqual(expected);
  });
});

describe('computeCascadeBounds', () => {
  type Input = { windows: CascadeWindow[]; container: ContainerSize; options?: { step?: number } };
  // Map は JSON に書けないので, 期待する結果は id をキーにしたオブジェクトで書き, 比べる前に揃える.
  test.for(cascadeBoundsCases as Case<Input, Record<string, Point>>[])('$name', ({ input, expected }) => {
    expect(Object.fromEntries(computeCascadeBounds(input.windows, input.container, input.options))).toEqual(expected);
  });
});

describe('computeNextOpenPosition', () => {
  type Laps = { x: number; y: number };
  type Options = { step?: number; lapOffset?: number | LapOffsetName };
  type Input = { lastPosition: Point; defaultPosition: Point; size: { width: number; height: number }; container: ContainerSize; laps: Laps; options?: Options };
  test.for(nextOpenPositionCases as Case<Input, { position: Point; laps: Laps }>[])('$name', ({ input, expected }) => {
    const { lastPosition, defaultPosition, size, container, laps, options = {} } = input;
    const lapOffset = typeof options.lapOffset === 'string' ? lapOffsets[options.lapOffset] : options.lapOffset;
    expect(computeNextOpenPosition(lastPosition, defaultPosition, size, container, laps, { step: options.step, lapOffset })).toEqual(expected);
  });
});

describe('halfLapOffset, goldenLapOffset', () => {
  type Input = { rule: LapOffsetName; step: number };
  test.for(lapOffsetCases as Case<Input, number>[])('$name', ({ input, expected }) => {
    expect(lapOffsets[input.rule](input.step)).toBe(expected);
  });
});
