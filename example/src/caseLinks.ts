// 表示を確認する状態を切り替えるリンクを, ページの右下に重ねて表示する. URL を打ちにくい端末 (タブレット等) で使う暫定のもの.
// silica が描く #root の外 (body の直下) に置き, silica には触らない. 見た目は index.html の .case-links.
import { LANGS, TITLE_CASES, type TitleCase, selectedTitleCase } from './cases.ts'

// 文書の言語を当てた後に呼ぶ.
export function showCaseLinks(): void {
  const nav = document.createElement('nav')
  nav.className = 'case-links'
  nav.setAttribute('aria-label', '表示を確認する状態')
  nav.append(
    row(LANGS.map((lang) => link(lang, 'lang', lang, lang === document.documentElement.lang))),
    row(
      (Object.keys(TITLE_CASES) as TitleCase[]).map((name) => link(name, 'title', name, name === selectedTitleCase())),
    ),
  )
  document.body.append(nav)
}

function row(links: HTMLAnchorElement[]): HTMLDivElement {
  const div = document.createElement('div')
  div.append(...links)
  return div
}

// 今の URL のクエリのうち, key だけを value に替えたリンク.
function link(label: string, key: string, value: string, current: boolean): HTMLAnchorElement {
  const url = new URL(location.href)
  url.searchParams.set(key, value)
  const a = document.createElement('a')
  a.href = url.href
  a.textContent = label
  if (current) a.setAttribute('aria-current', 'page')
  return a
}
