// アプリケーションとの契約の型. エントリ (src/index.ts) から出す.

declare const windowIdBrand: unique symbol;
declare const instanceIdBrand: unique symbol;

// ウインドウとインスタンスの id. 中身は数だが, 型の上では別のものにし, 取り違えをビルドで止める.
// 作れるのは silica だけで, アプリケーションは受け取った id を持ち回る.
export type WindowId = number & { readonly [windowIdBrand]: true };
export type InstanceId = number & { readonly [instanceIdBrand]: true };

// アプリケーションの名前. 文字列か, 言語ごとの表 (例 { ja: '...', en: '...' }).
export type AppName = string | Readonly<Record<string, string>>;

export interface AppDeclaration {
  // 所有者の名前を先頭に, ドットで区切った2段以上 (例 yamaoki.example.hello).
  readonly id: string;
  readonly name: AppName;
  // 実行中のインスタンスがあれば, 新しく起動せずにそちらへ渡すか.
  readonly singleInstance?: boolean;
  // 起動関数を default export するモジュールを読む. 宣言だけを先に読み, アプリケーションのコードは起動の時まで読まない.
  readonly load: () => Promise<{ default: AppStart }>;
}

// 開く要求. 書類や処理の指定を入れる所で, 中身は後で決める (#7).
export type OpenRequest = Readonly<Record<never, never>>;

export interface AppContext {
  readonly request: OpenRequest;
  readonly instanceId: InstanceId;
  // ウインドウを開き, その id を返す. 開けなければ例外を投げる.
  openWindow(options: { readonly title: string }): WindowId;
}

// 起動関数. 戻り値は任意で, 返すもの (開く要求を受ける関数, 後始末等) は使う所ができた時に型に追加する.
export type AppStart = (context: AppContext) => unknown;

// mount に渡すアプリケーション. 宣言そのものか, 宣言と組み込みの指定の組.
// 自動起動等は mount を書く人が決めることなので, 宣言には入れない.
export type AppEntry = AppDeclaration | { readonly app: AppDeclaration; readonly autostart?: boolean };

export interface MountOptions {
  readonly apps: readonly AppEntry[];
}
