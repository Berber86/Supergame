import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import './styles.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    const baseUrl = import.meta.env.BASE_URL
    navigator.serviceWorker.register(`${baseUrl}sw.js`, { scope: baseUrl }).catch(() => {
      // The game remains fully playable online when registration is unavailable.
    })
  })
}
