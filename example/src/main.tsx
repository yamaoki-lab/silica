import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { Provider } from '@react-spectrum/s2'
import { style } from '@react-spectrum/s2/style' with { type: 'macro' }
import '@react-spectrum/s2/page.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Provider background="base">
      <p className={style({ font: 'body' })}>silica の見本</p>
    </Provider>
  </StrictMode>,
)
