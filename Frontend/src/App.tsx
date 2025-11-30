import './App.css'
import { useKeycloak } from './KeycloakProvider'
import LandingPage from './LandingPage'
import Biblioteca from './biblioteca/biblioteca'

function App() {
  const { keycloak, authenticated } = useKeycloak()

  const handleLogout = () => {
    keycloak.logout()
  }

  // Se l'utente non è autenticato, mostra la landing page
  if (!authenticated) {
    return <LandingPage />
  }

  return (
    <div className="app-container">
      <Biblioteca keycloak={keycloak} handleLogout={handleLogout} />
    </div>
  )
}

export default App
