import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

// No <StrictMode>: its mount/unmount/mount cycle disposes the ReactorProvider's
// connection mid-handshake, so autoConnect never reaches "ready" in dev.
createRoot(document.getElementById('root')!).render(<App />)
