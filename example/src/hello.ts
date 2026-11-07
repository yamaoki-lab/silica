import type { AppStart } from 'silica'
import { TITLE_CASES, selectedTitleCase } from './cases.ts'

// 起動するとウインドウを1枚開く. 中身を描く仕組みはまだ無いので, タイトルだけ.
// タイトルは ?title=<ケース名> で指定する (cases.ts を参照).
const start: AppStart = ({ openWindow }) => {
  openWindow({ title: TITLE_CASES[selectedTitleCase()] })
}

export default start
