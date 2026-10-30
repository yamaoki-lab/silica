// 表示を確認する時の状態. URL のクエリで指定し, 同じ URL を開けば同じ状態から確認を始められる (後の自動テストからも使う).
// ?lang=ja|en で文書の言語を, ?title=<ケース名> でウインドウのタイトルを指定する. ?measure=drag でドラッグの時間を測る (measure.ts).

export const LANGS = ['ja', 'en'] as const
export type Lang = (typeof LANGS)[number]

// long はウインドウの幅に収まらず, 末尾が省略されるかを見るためのもの.
export const TITLE_CASES = {
  latin: 'Hello',
  cjk: 'こんにちは',
  mixed: 'Hello こんにちは',
  emoji: '👋 こんにちは',
  long: 'とても長いタイトルのウインドウ — 幅に収まらない時に末尾が省略されるかを確認する (A very long window title to check truncation)',
} as const
export type TitleCase = keyof typeof TITLE_CASES

const params = new URLSearchParams(location.search)

// 指定が無いか知らない値の時は, index.html の lang のまま.
export function selectedLang(): Lang | undefined {
  const lang = params.get('lang')
  return LANGS.find((value) => value === lang)
}

export function selectedTitleCase(): TitleCase {
  const name = params.get('title')
  return name !== null && Object.hasOwn(TITLE_CASES, name) ? (name as TitleCase) : 'cjk'
}

export function measuresDrag(): boolean {
  return params.get('measure') === 'drag'
}
