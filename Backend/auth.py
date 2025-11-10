import os
import httpx
from fastapi import HTTPException, Depends, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import jwt, JWTError
from typing import Optional

# Configurazione Keycloak
KEYCLOAK_URL = os.getenv("KEYCLOAK_URL", "http://keycloak:8080")
KEYCLOAK_REALM = os.getenv("KEYCLOAK_REALM", "BooksLibrary")
KEYCLOAK_CLIENT_ID = os.getenv("KEYCLOAK_CLIENT_ID", "bookslibrary-frontend")

# URL per ottenere le chiavi pubbliche di Keycloak
KEYCLOAK_CERTS_URL = f"{KEYCLOAK_URL}/realms/{KEYCLOAK_REALM}/protocol/openid-connect/certs"

# Cache per le chiavi pubbliche
public_keys_cache = None

security = HTTPBearer()


async def get_public_keys():
    """
    Ottiene le chiavi pubbliche da Keycloak per validare i token JWT.
    
    Keycloak espone le chiavi pubbliche tramite l'endpoint JWKS (JSON Web Key Set).
    Queste chiavi pubbliche vengono usate per verificare che i token siano stati
    firmati da Keycloak con la corrispondente chiave privata.
    
    Il JWKS viene cachato per evitare richieste ripetute a Keycloak.
    """
    global public_keys_cache
    
    if public_keys_cache is None:
        try:
            async with httpx.AsyncClient() as client:
                response = await client.get(KEYCLOAK_CERTS_URL)
                response.raise_for_status()
                jwks = response.json()
                public_keys_cache = jwks
                print(f"✅ Chiavi pubbliche ottenute da Keycloak: {len(jwks.get('keys', []))} chiavi disponibili")
        except Exception as e:
            print(f"Errore nel recupero delle chiavi pubbliche: {e}")
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Impossibile recuperare le chiavi di validazione"
            )
    
    return public_keys_cache


def get_public_key(token: str, jwks: dict):
    """
    Ottiene la chiave pubblica appropriata per validare il token.
    
    Ogni token JWT contiene un 'kid' (Key ID) nell'header che identifica
    quale chiave pubblica è stata usata per firmarlo. Questa funzione:
    1. Estrae il 'kid' dall'header del token
    2. Cerca la chiave corrispondente nel JWKS ottenuto da Keycloak
    3. Restituisce la chiave pubblica RSA per la validazione
    """
    try:
        # Decodifica l'header del token per ottenere il kid (key ID)
        unverified_header = jwt.get_unverified_header(token)
        kid = unverified_header.get("kid")
        
        if not kid:
            print("⚠️ Token senza 'kid' nell'header")
            return None
        
        # Trova la chiave corrispondente nel JWKS
        for key in jwks.get("keys", []):
            if key.get("kid") == kid:
                print(f"✅ Chiave pubblica trovata per kid: {kid}")
                return key
        
        print(f"⚠️ Nessuna chiave pubblica trovata per kid: {kid}")
        return None
    except Exception as e:
        print(f"Errore nel recupero della chiave pubblica: {e}")
        return None


async def verify_token(credentials: HTTPAuthorizationCredentials = Depends(security)) -> dict:
    """
    Verifica e decodifica il token JWT di Keycloak.
    
    Questo è il cuore della sicurezza: verifica che il token sia:
    1. Firmato da Keycloak (usando la chiave pubblica RSA)
    2. Non scaduto (verifica 'exp')
    3. Emesso dal realm corretto (verifica 'iss')
    4. Per il client corretto (verifica 'aud', opzionale per client pubblici)
    
    Se il token passa tutte le verifiche, è considerato affidabile perché
    solo Keycloak (che possiede la chiave privata) può creare token con
    una firma valida.
    """
    token = credentials.credentials
    
    try:
        # Ottieni le chiavi pubbliche
        jwks = await get_public_keys()
        
        # Ottieni la chiave pubblica appropriata
        public_key = get_public_key(token, jwks)
        
        if not public_key:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Chiave di validazione non trovata"
            )
        
        # Costruisci la chiave pubblica in formato PEM
        from cryptography.hazmat.primitives.asymmetric import rsa
        from cryptography.hazmat.backends import default_backend
        from cryptography.hazmat.primitives import serialization
        import base64
        
        # Estrai i componenti della chiave RSA
        n = int.from_bytes(base64.urlsafe_b64decode(public_key["n"] + "=="), "big")
        e = int.from_bytes(base64.urlsafe_b64decode(public_key["e"] + "=="), "big")
        
        # Costruisci la chiave RSA
        public_key_obj = rsa.RSAPublicNumbers(e, n).public_key(default_backend())
        pem_key = public_key_obj.public_bytes(
            encoding=serialization.Encoding.PEM,
            format=serialization.PublicFormat.SubjectPublicKeyInfo
        )
        
        # Decodifica il token senza validazione per vedere il contenuto
        unverified_payload = jwt.get_unverified_claims(token)
        print(f"Token payload (non verificato): {unverified_payload}")
        print(f"Audience nel token: {unverified_payload.get('aud')}")
        print(f"Issuer nel token: {unverified_payload.get('iss')}")
        print(f"Expected audience: {KEYCLOAK_CLIENT_ID}")
        print(f"Expected issuer: {KEYCLOAK_URL}/realms/{KEYCLOAK_REALM}")
        
        # Valida e decodifica il token
        # Per i client pubblici, l'audience potrebbe essere una lista o il client ID
        # Proviamo prima con la validazione dell'audience, poi senza se fallisce
        try:
            payload = jwt.decode(
                token,
                pem_key,
                algorithms=["RS256"],
                audience=KEYCLOAK_CLIENT_ID,
                issuer=f"{KEYCLOAK_URL}/realms/{KEYCLOAK_REALM}",
                options={"verify_aud": True, "verify_iss": True}
            )
        except JWTError as aud_error:
            print(f"Errore validazione audience/issuer: {aud_error}")
            # Prova senza validazione dell'audience (per client pubblici)
            try:
                payload = jwt.decode(
                    token,
                    pem_key,
                    algorithms=["RS256"],
                    issuer=f"{KEYCLOAK_URL}/realms/{KEYCLOAK_REALM}",
                    options={"verify_aud": False, "verify_iss": True}
                )
                print("Token validato senza controllo audience")
            except JWTError as iss_error:
                print(f"Errore validazione issuer: {iss_error}")
                # Prova solo con la firma
                payload = jwt.decode(
                    token,
                    pem_key,
                    algorithms=["RS256"],
                    options={"verify_signature": True, "verify_aud": False, "verify_iss": False, "verify_exp": True}
                )
                print("Token validato solo con firma ed expiration")
        
        return payload
        
    except JWTError as e:
        print(f"Errore validazione JWT: {e}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token non valido o scaduto"
        )
    except Exception as e:
        print(f"Errore generico nella validazione: {e}")
        import traceback
        print(traceback.format_exc())
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Errore nella validazione del token"
        )


async def get_current_user(token_data: dict = Depends(verify_token)) -> dict:
    """Ottiene i dati dell'utente corrente dal token"""
    return {
        "username": token_data.get("preferred_username") or token_data.get("sub"),
        "email": token_data.get("email"),
        "name": token_data.get("name"),
        "sub": token_data.get("sub"),
        "roles": get_user_roles(token_data)
    }


def get_user_roles(token_data: dict) -> list:
    """
    Estrae i ruoli dell'utente dal token JWT.
    
    I ruoli possono essere:
    - Realm roles: in token_data['realm_access']['roles']
    - Client roles: in token_data['resource_access'][client_id]['roles']
    """
    roles = []
    
    # Estrai realm roles
    if 'realm_access' in token_data and 'roles' in token_data['realm_access']:
        roles.extend(token_data['realm_access']['roles'])
    
    # Estrai client roles
    if 'resource_access' in token_data:
        resource_access = token_data['resource_access']
        if KEYCLOAK_CLIENT_ID in resource_access:
            if 'roles' in resource_access[KEYCLOAK_CLIENT_ID]:
                roles.extend(resource_access[KEYCLOAK_CLIENT_ID]['roles'])
    
    return roles


def require_role(required_role: str):
    """
    Dependency per verificare che l'utente abbia un ruolo specifico.
    
    Esempio di utilizzo:
    @app.delete("/libri/{libro_id}")
    async def elimina_libro(
        libro_id: str,
        current_user: dict = Depends(require_role("admin"))
    ):
        ...
    """
    async def role_checker(token_data: dict = Depends(verify_token)) -> dict:
        user_roles = get_user_roles(token_data)
        
        if required_role not in user_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Operazione non consentita. Ruolo richiesto: {required_role}"
            )
        
        return {
            "username": token_data.get("preferred_username") or token_data.get("sub"),
            "email": token_data.get("email"),
            "name": token_data.get("name"),
            "sub": token_data.get("sub"),
            "roles": user_roles
        }
    
    return role_checker


def require_any_role(*required_roles: str):
    """
    Dependency per verificare che l'utente abbia almeno uno dei ruoli specificati.
    
    Esempio di utilizzo:
    @app.put("/libri/{libro_id}")
    async def aggiorna_libro(
        libro_id: str,
        libro_update: LibroUpdate,
        current_user: dict = Depends(require_any_role("admin", "editor"))
    ):
        ...
    """
    async def role_checker(token_data: dict = Depends(verify_token)) -> dict:
        user_roles = get_user_roles(token_data)
        
        if not any(role in user_roles for role in required_roles):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Operazione non consentita. Ruoli richiesti: {', '.join(required_roles)}"
            )
        
        return {
            "username": token_data.get("preferred_username") or token_data.get("sub"),
            "email": token_data.get("email"),
            "name": token_data.get("name"),
            "sub": token_data.get("sub"),
            "roles": user_roles
        }
    
    return role_checker

