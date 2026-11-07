// ウインドウのドラッグの1フレームの時間を測る. ?measure=drag で走らせ, 結果を右下のリンクの下と console に表示する.
// 合成したポインタのイベントを1フレームに1回タイトルバーへ送るので, 入力の遅れは含まない. どのブラウザでも同じ手順で測り直せる.

const FRAMES = 300
// タイトルバーを押した点を中心に, 半径 RADIUS の円を LAP フレームで1周させる. 領域の端の制限にかからない大きさにする.
const RADIUS = 80
const LAP = 120

interface Stats {
  median: number
  p95: number
  max: number
}

export async function measureDrag(): Promise<string> {
  // 隠れたページではフレームが進まないか間引かれ, 測った値が使えない.
  if (document.visibilityState !== 'visible') return 'ページが隠れているので測らなかった. 表示した状態で読み直してください.'
  const titleBar = await findTitleBar()
  const root = titleBar.parentElement?.parentElement
  if (root === null || root === undefined) throw new Error('ウインドウの要素が見つからない')
  const rect = titleBar.getBoundingClientRect()
  const origin = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 }
  const before = root.style.transform

  const handler: number[] = []
  const flush: number[] = []
  const interval: number[] = []

  // 合成したポインタは実在しないので, ブラウザによっては setPointerCapture が例外を投げる. 測る間だけ何もしない関数に替える.
  const capture = Element.prototype.setPointerCapture
  Element.prototype.setPointerCapture = () => {}
  try {
    titleBar.dispatchEvent(pointer('pointerdown', origin))
    let last = await nextFrame()
    for (let i = 1; i <= FRAMES; i++) {
      const angle = (2 * Math.PI * i) / LAP
      const point = { x: origin.x + RADIUS * (Math.cos(angle) - 1), y: origin.y + RADIUS * Math.sin(angle) }
      // rAF のコールバックは登録した順に走る. 次のフレームでは, ここで先に登録したもの, silica の書き込み, 測る側の順に走るので, 最初と最後の差が書き込みの時間になる.
      let frameStart = 0
      requestAnimationFrame(() => {
        frameStart = performance.now()
      })
      const start = performance.now()
      titleBar.dispatchEvent(pointer('pointermove', point))
      handler.push(performance.now() - start)
      const frame = await nextFrame()
      flush.push(performance.now() - frameStart)
      interval.push(frame - last)
      last = frame
    }
    titleBar.dispatchEvent(pointer('pointerup', origin))
  } finally {
    Element.prototype.setPointerCapture = capture
  }

  const moved = root.style.transform !== before
  const frames = summarize(interval)
  // フレーム落ちが動かし始めに寄るか, 途中に散らばるかを見るため, 何フレーム目かを添える. 番号は 1 から.
  const dropped = interval.flatMap((value, i) => (value > frames.median * 1.5 ? [`${i + 1} (${value.toFixed(1)})`] : []))
  return [
    `ドラッグの1フレーム (${FRAMES} フレーム, 合成したイベント)`,
    `pointermove の処理: ${format(summarize(handler))}`,
    `ストアと transform の書き込み: ${format(summarize(flush))}`,
    `フレームの間隔: ${format(frames)}`,
    `フレーム落ち (間隔が中央値の 1.5 倍を超えたもの): ${dropped.length}`,
    `落ちたフレームの番号 (間隔 ms): ${dropped.length === 0 ? 'なし' : dropped.slice(0, 10).join(', ')}${dropped.length > 10 ? ' ほか' : ''}`,
    `performance.now() の精度 (見積もり): ${nowPrecision().toFixed(3)} ms`,
    `ウインドウが動いたか: ${moved ? 'はい' : 'いいえ (測り方が効いていない)'}`,
    navigator.userAgent,
  ].join('\n')
}

function pointer(type: string, { x, y }: { x: number; y: number }): PointerEvent {
  return new PointerEvent(type, {
    pointerId: 1,
    pointerType: 'mouse',
    isPrimary: true,
    button: type === 'pointermove' ? -1 : 0,
    buttons: type === 'pointerup' ? 0 : 1,
    clientX: x,
    clientY: y,
    bubbles: true,
    cancelable: true,
  })
}

function nextFrame(): Promise<number> {
  return new Promise((resolve) => requestAnimationFrame(resolve))
}

// mount の後, ウインドウが置かれる (transform が付く) まで待つ. タイトルバーは, 位置を持つ要素の中の枠の最初の子.
async function findTitleBar(): Promise<HTMLElement> {
  for (let i = 0; i < 300; i++) {
    const root = [...document.querySelectorAll<HTMLElement>('#root div')].find((div) => div.style.transform !== '')
    const titleBar = root?.firstElementChild?.firstElementChild
    if (titleBar instanceof HTMLElement) return titleBar
    await nextFrame()
  }
  throw new Error('ウインドウが現れない')
}

function summarize(values: readonly number[]): Stats {
  const sorted = [...values].sort((a, b) => a - b)
  const at = (ratio: number) => sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * ratio))] ?? 0
  return { median: at(0.5), p95: at(0.95), max: sorted.at(-1) ?? 0 }
}

function format({ median, p95, max }: Stats): string {
  return `中央値 ${median.toFixed(3)} / 95% ${p95.toFixed(3)} / 最大 ${max.toFixed(3)} ms`
}

// performance.now() が進む最小の幅. ブラウザによっては精度を落としていて, それより短い時間は 0 に見える.
function nowPrecision(): number {
  let smallest = Infinity
  for (let i = 0; i < 20; i++) {
    const start = performance.now()
    let now = start
    while (now === start) now = performance.now()
    smallest = Math.min(smallest, now - start)
  }
  return smallest
}
