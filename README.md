# silica

Web の画面のフレームワーク. ウインドウの管理, メニュー, 見た目を持ち, 使う側がアプリケーションを差し込んで組み立てる.

作り始めたところで, まだ使えるコンポーネントはありません.

## 構成

- `src/agate/`: ウインドウの状態, 位置と大きさ, 重なり順
- `src/passion/`: 見た目
- `src/view/`: アプリケーションとの契約と, agate と passion を組み合わせるコンポーネント
- `src/apps/`: 付属のアプリケーション. `silica/apps` から import する
- `src/session/`: セッションを TS から使う所. .proto から生成した型とセッションの wasm もここに作られる (リポジトリには入れない)
- `session/`: セッション (Rust). アプリケーションとウインドウの状態のうち, OS から見えない側を持つ. ページへは wasm で渡す
- `proto/`: ページやシェルとセッションの間で受け渡すメッセージ
- `example/`: silica を使う側のサンプル

レイヤの依存の向きは `view → agate` と `view → passion` だけで, lint で縛っています. 付属のアプリケーションも, 外のアプリケーションと同じく公開のエントリ (`src/index.ts`) だけを使います.

動作を確かめるブラウザは, 主に Firefox Developer Edition と WebView2 の, それぞれ最新版です (2026年9月の時点で, Firefox Developer Edition 157 と WebView2 154).

## 開発

Node のバージョンは `.node-version`, pnpm のバージョンは `package.json` の `packageManager`, Rust のバージョンは `rust-toolchain.toml` で決めています. Rust は rustup を入れておけば, 決めたバージョンが自動で入ります.

```sh
pnpm install
pnpm dev        # サンプルを開く
pnpm typecheck
pnpm lint
pnpm test
pnpm build      # dist にビルドする
pnpm build:wasm # セッションの wasm をビルドする
pnpm check:size # セッションの大きさを測る (先に build:wasm)
cargo test      # セッションのテスト
```

dev, typecheck, test, build は, 先に .proto から TS の型を作ります (`pnpm gen`).

## ライセンス

MIT
