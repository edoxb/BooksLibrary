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
    // Flag globale per evitare doppie inizializzazioni anche con StrictMode
    if ((window as any).__keycloak_initializing__) {
      return;
    }
    
    // Evita doppie inizializzazioni - verifica anche se Keycloak è già inizializzato
    if (initialized || keycloak.authenticated !== undefined) {
      setLoading(false);
      return;
    }
    
    // Imposta flag globale per prevenire inizializzazioni multiple
    (window as any).__keycloak_initializing__ = true;
    setInitialized(true);
    
    const initKeycloak = async () => {
      try {
        // Verifica se c'è un codice di autorizzazione nell'URL (callback dopo login)
        const urlParams = new URLSearchParams(window.location.search);
        const hasCode = urlParams.has('code');
        
        // Verifica se Keycloak è già inizializzato
        if (keycloak.authenticated !== undefined) {
          setAuthenticated(keycloak.authenticated);
          setLoading(false);
          (window as any).__keycloak_initializing__ = false;
          return;
        }
        
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
        // Se l'errore è "already initialized", ignoralo
        if (error instanceof Error && error.message.includes('already initialized')) {
          setAuthenticated(keycloak.authenticated || false);
        } else {
          console.error('Errore inizializzazione Keycloak:', error);
          setAuthenticated(false);
        }
        setInitialized(false);
        (window as any).__keycloak_initializing__ = false;
      } finally {
        setLoading(false);
        (window as any).__keycloak_initializing__ = false;
      }
    };

    initKeycloak();
    
    // Cleanup function per StrictMode
    return () => {
      // Non fare cleanup di Keycloak qui, solo resetta il flag se necessario
      if ((window as any).__keycloak_initializing__) {
        (window as any).__keycloak_initializing__ = false;
      }
    };
  }, []);

  // Listener per aggiornamenti dello stato di autenticazione - fuori da useEffect per evitare registrazioni multiple
  useEffect(() => {
    // Registra i listener solo una volta
    if (!keycloak.onAuthSuccess) {
      keycloak.onAuthSuccess = () => {
        console.log('Autenticazione riuscita');
        setAuthenticated(true);
        // Assicurati che il codice sia stato rimosso dall'URL
        if (window.location.search.includes('code=')) {
          window.history.replaceState({}, document.title, window.location.pathname);
        }
      };
    }

    if (!keycloak.onAuthError) {
      keycloak.onAuthError = (error: unknown) => {
        console.error('Errore autenticazione:', error);
        setAuthenticated(false);
      };
    }

    if (!keycloak.onTokenExpired) {
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
    }
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
