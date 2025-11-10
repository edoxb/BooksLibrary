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
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center', 
        marginBottom: '1rem',
        paddingBottom: '1rem',
        borderBottom: '1px solid #ddd'
      }}>
        <h1>📚 BooksLibrary</h1>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          {keycloak.tokenParsed && (
            <span style={{ fontSize: '0.9rem', color: '#666' }}>
              👤 {keycloak.tokenParsed.preferred_username || keycloak.tokenParsed.name || 'Utente'}
            </span>
          )}
          <button
            onClick={handleLogout}
            style={{
              padding: '0.5rem 1rem',
              fontSize: '0.9rem',
              cursor: 'pointer',
              backgroundColor: '#f44336',
              color: 'white',
              border: 'none',
              borderRadius: '4px'
            }}
          >
            🚪 Esci
          </button>
        </div>
      </div>
      
      <Biblioteca />
    </div>
  )
}

export default App
