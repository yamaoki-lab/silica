import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { Provider } from '@react-spectrum/s2'
import '@react-spectrum/s2/page.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Provider background="base">
      <p>silica の見本</p>
    </Provider>
  </StrictMode>,
)
