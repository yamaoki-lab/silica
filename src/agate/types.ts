// 掴んでリサイズする辺と角. 東西南北の頭文字で表す.
export type ResizeEdge = 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw';

// ウインドウの位置と大きさ. 単位は CSS の px で, ウインドウを置く領域の左上が原点.
export interface Bounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

// ウインドウを置く領域 (メニューバーを除いたビューポートの中) の大きさ.
export interface ContainerSize {
  width: number;
  height: number;
}

// アプリケーションが指定する希望サイズと最小サイズ. どちらも中身の大きさで,
// 枠, タイトルバー, フレームワークが付ける余白を含まない. OS のウインドウに
// 切り離した時も, 同じ数値をそのままシェルへ渡せるようにするため.
// 値は軸ごとに省ける. 省いた値は指定なしで, フレームワークに任せる.
// 中身を測るか数値を決めるかは view の側の関数が決め, ここには返った数値だけが入る.
// ただのデータで, protobuf に写せる形にしておく.
export interface PreferredSize {
  width?: number;
  height?: number;
  minWidth?: number;
  minHeight?: number;
}

// 中身の周りにフレームワークが付けるもの (枠, タイトルバー, 余白) の, 幅と高さの合計.
// タイトルバーの向きやコンパクトの表示, 倍率で変わるので, view が測る.
export interface FrameExtent {
  width: number;
  height: number;
}

// ビューポートの情報. ジオメトリの側がビューポートごとに持つ. 単位は CSS の px.
// 大きさと倍率は, OS のウインドウならシェルが, ブラウザのウインドウならページが知らせる.
// ページの中にメニューバーがある時, ウインドウを置く領域 (ContainerSize) は
// この大きさからメニューバーを除いたものになる.
// ただのデータで, protobuf に写せる形にしておく.
export interface ViewportInfo {
  width: number;
  height: number;
  // CSS の px 1つに当たる, 画面の画素の数.
  scale: number;
  // ウインドウのタイトルバーの太さ. view が測り, カスケードの間隔に使う.
  // 向きやコンパクトの表示, 倍率で変わるので, ビューポートごとに持つ.
  titleBarThickness: number;
}
