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

  useEffect(() => {
    const initKeycloak = async () => {
      try {
        const authenticated = await keycloak.init({
          onLoad: 'check-sso',
          silentCheckSsoRedirectUri: window.location.origin + '/silent-check-sso.html',
          pkceMethod: 'S256',
        });
        setAuthenticated(authenticated);
      } catch (error) {
        console.error('Errore inizializzazione Keycloak:', error);
        setAuthenticated(false);
      } finally {
        setLoading(false);
      }
    };

    initKeycloak();

    // Listener per aggiornamenti dello stato di autenticazione
    keycloak.onAuthSuccess = () => {
      setAuthenticated(true);
    };

    keycloak.onAuthError = () => {
      setAuthenticated(false);
    };

    keycloak.onTokenExpired = () => {
      keycloak.updateToken(30).catch(() => {
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
