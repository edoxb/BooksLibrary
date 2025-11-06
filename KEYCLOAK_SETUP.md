# Configurazione Keycloak per BooksLibrary

Questa guida spiega come configurare Keycloak per l'autenticazione dell'applicazione BooksLibrary.

## Prerequisiti

1. Docker e Docker Compose installati
2. I servizi devono essere avviati con `docker-compose up`

## Configurazione Keycloak

### 1. Accesso all'Admin Console

1. Avvia i servizi con `docker-compose up`
2. Attendi che Keycloak sia completamente avviato (può richiedere alcuni minuti)
3. Accedi all'Admin Console all'indirizzo: `http://localhost:8080`
4. Usa le credenziali:
   - Username: `admin`
   - Password: `admin`

### 2. Creazione del Realm

1. Dalla sidebar, clicca su "Master" (dropdown in alto a sinistra)
2. Clicca su "Create Realm"
3. Inserisci il nome del realm: `bookslibrary`
4. Clicca su "Create"

### 3. Creazione del Client

1. Nel realm `bookslibrary`, vai su "Clients" nella sidebar
2. Clicca su "Create client"
3. Inserisci:
   - Client ID: `bookslibrary-frontend`
   - Client authentication: **OFF** (per un client pubblico)
   - Authorization: **OFF**
4. Clicca su "Next"
5. Nelle impostazioni:
   - Access Type: `public`
   - Standard flow: **ON**
   - Direct access grants: **ON** (opzionale, per login diretto)
   - Valid redirect URIs: `http://localhost:5173/*`
   - Web origins: `http://localhost:5173`
6. Clicca su "Save"

### 4. Creazione di un Utente di Test

1. Vai su "Users" nella sidebar
2. Clicca su "Create new user"
3. Compila i campi:
   - Username: (es. `testuser`)
   - Email: (es. `test@example.com`)
   - First name: (opzionale)
   - Last name: (opzionale)
   - Email verified: **ON**
4. Clicca su "Create"
5. Vai alla tab "Credentials"
6. Imposta una password:
   - Password: (inserisci una password)
   - Temporary: **OFF** (per non richiedere il cambio password al primo accesso)
7. Clicca su "Set password"

## Test dell'Autenticazione

1. Avvia l'applicazione frontend: `http://localhost:5173`
2. Dovresti vedere la schermata di login
3. Clicca su "Accedi"
4. Verrai reindirizzato a Keycloak per il login
5. Usa le credenziali dell'utente creato
6. Dopo il login, verrai reindirizzato all'applicazione

## Configurazione Avanzata

### Impostazioni del Client

Nel client `bookslibrary-frontend`, puoi configurare:

- **Access Token Lifespan**: Durata del token di accesso (default: 5 minuti)
- **SSO Session Idle**: Tempo di inattività prima del logout automatico
- **SSO Session Max**: Durata massima della sessione

### Configurazione per Produzione

Per un ambiente di produzione:

1. Cambia le password di default
2. Configura HTTPS
3. Usa variabili d'ambiente per le configurazioni sensibili
4. Abilita la validazione degli hostname in Keycloak
5. Configura i redirect URI corretti per il dominio di produzione

## Troubleshooting

### Keycloak non si avvia

- Verifica che la porta 8080 non sia già in uso
- Controlla i log: `docker-compose logs keycloak`
- Assicurati che PostgreSQL sia avviato correttamente

### Errore "Invalid redirect URI"

- Verifica che l'URI di redirect nel client corrisponda all'URL del frontend
- Assicurati che il client sia configurato come "public"

### Token non valido

- Verifica che il realm e il client ID siano corretti nelle variabili d'ambiente
- Controlla che il backend possa raggiungere Keycloak sulla rete Docker

