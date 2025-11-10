import { type ReactNode, useEffect, useState, createContext, useContext } from 'react';
import keycloak from './keycloak';

interface KeycloakContextValue {
  keycloak: typeof keycloak;
  authenticated: boolean;
  loading: boolean;
}

const KeycloakContext = createContext<KeycloakContextValue | undefined>(undefined);

interface KeycloakProviderProps {
  children: ReactNode;
}

export const KeycloakProvider = ({ children }: KeycloakProviderProps) => {
  const [authenticated, setAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    // Evita doppie inizializzazioni
    if (initialized) return;
    
    const initKeycloak = async () => {
      try {
        setInitialized(true);
        
        // Verifica se c'è un codice di autorizzazione nell'URL (callback dopo login)
        const urlParams = new URLSearchParams(window.location.search);
        const hasCode = urlParams.has('code');
        
        const authenticated = await keycloak.init({
          onLoad: hasCode ? 'login-required' : 'check-sso',
          silentCheckSsoRedirectUri: window.location.origin + '/silent-check-sso.html',
          pkceMethod: 'S256',
          checkLoginIframe: false,
        });
        
        setAuthenticated(authenticated);
        
        // Rimuovi il codice dall'URL DOPO che Keycloak lo ha usato
        if (hasCode && authenticated) {
          window.history.replaceState({}, document.title, window.location.pathname);
        }
      } catch (error) {
        console.error('Errore inizializzazione Keycloak:', error);
        setAuthenticated(false);
        setInitialized(false); // Permetti un nuovo tentativo in caso di errore
      } finally {
        setLoading(false);
      }
    };

    initKeycloak();

    // Listener per aggiornamenti dello stato di autenticazione
    keycloak.onAuthSuccess = () => {
      console.log('Autenticazione riuscita');
      setAuthenticated(true);
      // Assicurati che il codice sia stato rimosso dall'URL
      if (window.location.search.includes('code=')) {
        window.history.replaceState({}, document.title, window.location.pathname);
      }
    };

    keycloak.onAuthError = (error: unknown) => {
      console.error('Errore autenticazione:', error);
      setAuthenticated(false);
    };

    keycloak.onTokenExpired = () => {
      keycloak.updateToken(30).then((refreshed: boolean) => {
        if (refreshed) {
          console.log('Token aggiornato');
        } else {
          console.log('Token non ancora scaduto');
        }
      }).catch(() => {
        console.error('Errore nel rinnovo del token');
        setAuthenticated(false);
      });
    };
  }, []);

  const value: KeycloakContextValue = {
    keycloak,
    authenticated,
    loading,
  };

  if (loading) {
    return (
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        height: '100vh',
        fontSize: '1.2rem'
      }}>
        Caricamento...
      </div>
    );
  }

  return (
    <KeycloakContext.Provider value={value}>
      {children}
    </KeycloakContext.Provider>
  );
};

export const useKeycloak = (): KeycloakContextValue => {
  const context = useContext(KeycloakContext);
  if (context === undefined) {
    throw new Error('useKeycloak deve essere usato all\'interno di KeycloakProvider');
  }
  return context;
};
