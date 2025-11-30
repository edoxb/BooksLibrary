import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { KeycloakProvider } from './KeycloakProvider.tsx'

createRoot(document.getElementById('root')!).render(
  <KeycloakProvider>
    <App />
  </KeycloakProvider>
)
