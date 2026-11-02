import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App'

function render() {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
}

if (import.meta.env.VITE_SYNC_ENABLED === 'true') {
  void import('./app/syncBoot').then(m => m.startSync()).catch(() => undefined).finally(render)
} else {
  render()
}
