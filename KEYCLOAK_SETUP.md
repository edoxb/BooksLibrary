# Configurazione Keycloak per BooksLibrary

Questa guida spiega come configurare Keycloak per l'autenticazione dell'applicazione BooksLibrary.

## Prerequisiti

1. Docker e Docker Compose installati
2. I servizi devono essere avviati con `docker-compose up`

## Configurazione Keycloak

### 1. Accesso all'Admin Console

1. Avvia i servizi con `docker-compose up`
2. Attendi che Keycloak sia completamente avviato (può richiedere alcuni minuti)
3. Accedi all'Admin Console all'indirizzo: `http://auth.localhost` (tramite Traefik) o `http://localhost:8080` (se esposto direttamente)
4. Usa le credenziali:
   - Username: `admin`
   - Password: `admin`

### 2. Creazione del Realm

1. Dalla sidebar, clicca su "Master" (dropdown in alto a sinistra)
2. Clicca su "Create Realm"
3. Inserisci il nome del realm: `BooksLibrary` (nota: case-sensitive, con maiuscole)
4. Clicca su "Create"

**Nota:** Se hai già un realm export, puoi importarlo direttamente invece di crearlo manualmente.

### 3. Creazione del Client

1. Nel realm `BooksLibrary`, vai su "Clients" nella sidebar
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
   - Valid redirect URIs: 
     - `http://localhost:5173/*` (per sviluppo diretto)
     - `http://app.localhost/*` (per accesso tramite Traefik)
   - Web origins: 
     - `http://localhost:5173`
     - `http://app.localhost`
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
- Se usi Traefik, assicurati di aver aggiunto `http://app.localhost/*` ai Valid redirect URIs
- Assicurati che il client sia configurato come "public"

### Token non valido

- Verifica che il realm e il client ID siano corretti nelle variabili d'ambiente
- Controlla che il backend possa raggiungere Keycloak sulla rete Docker

## Configurazione dei Ruoli (Autorizzazione)

### 1. Creazione di Ruoli Realm

I ruoli realm sono ruoli a livello di realm che possono essere assegnati a qualsiasi utente.

1. Nel realm `BooksLibrary`, vai su "Realm roles" nella sidebar
2. Clicca su "Create role"
3. Crea i seguenti ruoli:
   - **admin**: per gli amministratori (possono eliminare libri, vedere statistiche)
   - **editor**: per gli editori (possono creare e modificare libri)
   - **user**: per gli utenti normali (possono solo visualizzare i libri)

### 2. Creazione di Ruoli Client (Opzionale)

I ruoli client sono specifici per un client e possono essere più granulari.

1. Vai su "Clients" → `bookslibrary-frontend`
2. Vai alla tab "Roles"
3. Clicca su "Create role"
4. Crea ruoli specifici per il client se necessario

### 3. Assegnazione di Ruoli agli Utenti

1. Vai su "Users" nella sidebar
2. Seleziona l'utente a cui vuoi assegnare i ruoli
3. Vai alla tab "Role mapping"
4. Clicca su "Assign role"
5. Seleziona i ruoli da assegnare (realm roles o client roles)
6. Clicca su "Assign"

### 4. Configurazione del Client per Includere i Ruoli nel Token

1. Vai su "Clients" → `bookslibrary-frontend`
2. Vai alla tab "Mappers"
3. Verifica che esista un mapper per i ruoli:
   - Se non esiste, clicca su "Create"
   - Name: `roles`
   - Mapper Type: `User Realm Role` (per realm roles) o `User Client Role` (per client roles)
   - Token Claim Name: `roles` (o `realm_access.roles` per realm roles)
   - Add to access token: **ON**
   - Add to ID token: **ON** (opzionale)

### 5. Esempi di Utilizzo nel Backend

Il backend supporta tre modi per verificare i ruoli:

#### Verifica di un singolo ruolo:
```python
@app.delete("/libri/{libro_id}")
async def elimina_libro(
    libro_id: str,
    current_user: dict = Depends(require_role("admin"))
):
    # Solo gli utenti con ruolo "admin" possono eliminare libri
    ...
```

#### Verifica di almeno uno tra più ruoli:
```python
@app.put("/libri/{libro_id}")
async def aggiorna_libro(
    libro_id: str,
    libro_update: LibroUpdate,
    current_user: dict = Depends(require_any_role("admin", "editor"))
):
    # Gli utenti con ruolo "admin" o "editor" possono modificare libri
    ...
```

#### Ottenere i ruoli dell'utente:
```python
@app.get("/user/roles")
async def get_my_roles(current_user: dict = Depends(get_current_user)):
    # Restituisce i ruoli dell'utente corrente
    return {"roles": current_user.get("roles", [])}
```

### 6. Endpoint di Esempio

- **GET /user/roles**: Ottiene i ruoli dell'utente corrente (richiede autenticazione)
- **GET /admin/stats**: Statistiche del sistema (richiede ruolo "admin")
- **DELETE /libri/{libro_id}**: Elimina un libro (richiede ruolo "admin")

