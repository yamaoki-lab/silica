import { type AppDeclaration, mount } from 'silica'
import '@react-spectrum/s2/page.css'
import { measuresDrag, selectedLang } from './cases.ts'
import { showCaseLinks, showResult } from './caseLinks.ts'

const hello: AppDeclaration = {
  id: 'yamaoki.example.hello',
  name: { ja: 'こんにちは', en: 'Hello' },
  load: () => import('./hello.ts'),
}

// 文書の言語は描く前に決める. S2 は言語で行の高さを変えるため.
const lang = selectedLang()
if (lang !== undefined) document.documentElement.lang = lang
const links = showCaseLinks()

await mount(document.getElementById('root')!, { apps: [{ app: hello, autostart: true }] })

// 測る時だけ読み込む.
if (measuresDrag()) {
  const { measureDrag } = await import('./measure.ts')
  const result = await measureDrag().catch((error: unknown) => `測れなかった: ${String(error)}`)
  console.log(result)
  showResult(links, result)
}
