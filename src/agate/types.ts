// 掴んでリサイズする辺と角. 東西南北の頭文字で表す.
export type ResizeEdge = 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw';

// ウインドウの位置と大きさ. 単位は CSS の px で, ウインドウを置く領域の左上が原点.
export interface Bounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

// ウインドウを置く領域 (メニューバーを除いた面の中) の大きさ.
export interface ContainerSize {
  width: number;
  height: number;
}
