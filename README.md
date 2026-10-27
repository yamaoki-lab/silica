# silica

Web の画面のフレームワーク. ウインドウの管理, メニュー, 見た目を持ち, 使う側がアプリケーションを差し込んで組み立てる.

作り始めたところで, まだ使えるコンポーネントはありません.

## 構成

- `src/agate/`: ウインドウの状態, 位置と大きさ, 重なり順
- `src/passion/`: 見た目
- `src/view/`: アプリケーションとの契約と, agate と passion を組み合わせるコンポーネント
- `src/apps/`: 付属のアプリケーション. `silica/apps` から import する
- `src/vite/`: 使う側の Vite の設定に足すプラグイン (`plugins: [silica(), react()]`). `silica/vite` から import する. 使う側のビルドの時に Node で動く
- `src/session/`: セッションを TS から使う所 (ラッパーと, wasm を読んで立ち上げる処理). .proto から生成した型とセッションの wasm もここに作られる (リポジトリには入れない)
- `session/`: セッション (Rust). アプリケーションとウインドウの状態のうち, OS から見えない側を持つ. ページへは wasm で渡す. テストのシナリオは `session/testdata/scenarios/` にあり, cargo test と pnpm test の両方で流す
- `proto/`: ページやシェルとセッションの間で受け渡すメッセージ
- `example/`: silica を使う側のサンプル

レイヤの依存の向きは `view → agate`, `view → passion`, `view → session` だけで, lint で縛っています. 付属のアプリケーションも, 外のアプリケーションと同じく公開のエントリ (`src/index.ts`) だけを使います. `src/vite/` は Node で動くので, ページで動く層を使いません.

動作を確かめるブラウザは, 主に Firefox Developer Edition と WebView2 の, それぞれ最新版です (2026年9月の時点で, Firefox Developer Edition 157 と WebView2 154).

## 開発

Node のバージョンは `.node-version`, pnpm のバージョンは `package.json` の `packageManager`, Rust のバージョンは `rust-toolchain.toml` で決めています. Rust は rustup を入れておけば, 決めたバージョンが自動で入ります.

```sh
pnpm install
pnpm dev        # サンプルを開く
pnpm typecheck
pnpm lint
pnpm test
pnpm build      # 型の宣言, セッションの wasm, silica/vite の JS を作る
pnpm build:wasm # セッションの wasm をビルドする
pnpm build:vite # silica/vite を JS にビルドする
pnpm check:size # セッションの大きさを測る (先に build:wasm)
cargo test      # セッションのテスト
```

dev, typecheck, test, build は, 先に .proto から TS の型を作ります (`pnpm gen`). test と build はセッションの wasm もビルドします. dev と build は silica/vite も JS にビルドします.

silica は TS のソースのまま配り, 使う側のビルドが一緒にビルドします. パッケージ (`pnpm pack` の tgz) には, ソースと, 型の宣言 (`dist` の .d.ts) と, ビルド済みのセッションの wasm と, JS にビルドした silica/vite (`dist/vite/`) が入ります. silica/vite だけを JS にするのは, 使う側の設定を読む時に Node が直に動かし, Node は node_modules の中の .ts を読めないためです.

## ライセンス

MIT
