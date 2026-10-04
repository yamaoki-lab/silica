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

interface Case<Input, Expected> {
  name: string;
  input: Input;
  expected: Expected;
}

type Point = { x: number; y: number };

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
  type Input = { windows: CascadeWindow[]; container: ContainerSize };
  // Map は JSON に書けないので, 期待する結果は id をキーにしたオブジェクトで書き, 比べる前に揃える.
  test.for(cascadeBoundsCases as Case<Input, Record<string, Point>>[])('$name', ({ input, expected }) => {
    expect(Object.fromEntries(computeCascadeBounds(input.windows, input.container))).toEqual(expected);
  });
});

describe('computeNextOpenPosition', () => {
  type Input = { lastPosition: Point; defaultPosition: Point; size: { width: number; height: number }; container: ContainerSize; lap: number };
  test.for(nextOpenPositionCases as Case<Input, { position: Point; lap: number }>[])('$name', ({ input, expected }) => {
    const { lastPosition, defaultPosition, size, container, lap } = input;
    expect(computeNextOpenPosition(lastPosition, defaultPosition, size, container, lap)).toEqual(expected);
  });
});
