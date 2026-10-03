// 場面は testdata/geometry/ の JSON に, 名前と入力と期待する結果の組で書く. ここでは流すだけにする.
import { describe, expect, test } from 'vitest';
import { computeMovedPosition, computeResizedBounds } from './geometry.ts';
import type { Bounds, ContainerSize, ResizeEdge } from './types.ts';
import movedPositionCases from './testdata/geometry/computeMovedPosition.json' with { type: 'json' };
import resizedBoundsCases from './testdata/geometry/computeResizedBounds.json' with { type: 'json' };

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
