import os
import httpx
from fastapi import HTTPException, Depends, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import jwt, JWTError
from typing import Optional

# Configurazione Keycloak
KEYCLOAK_URL = os.getenv("KEYCLOAK_URL", "http://keycloak:8080")
KEYCLOAK_REALM = os.getenv("KEYCLOAK_REALM", "bookslibrary")
KEYCLOAK_CLIENT_ID = os.getenv("KEYCLOAK_CLIENT_ID", "bookslibrary-frontend")

# URL per ottenere le chiavi pubbliche di Keycloak
KEYCLOAK_CERTS_URL = f"{KEYCLOAK_URL}/realms/{KEYCLOAK_REALM}/protocol/openid-connect/certs"

# Cache per le chiavi pubbliche
public_keys_cache = None

security = HTTPBearer()


async def get_public_keys():
    """Ottiene le chiavi pubbliche da Keycloak per validare i token JWT"""
    global public_keys_cache
    
    if public_keys_cache is None:
        try:
            async with httpx.AsyncClient() as client:
                response = await client.get(KEYCLOAK_CERTS_URL)
                response.raise_for_status()
                jwks = response.json()
                public_keys_cache = jwks
        except Exception as e:
            print(f"Errore nel recupero delle chiavi pubbliche: {e}")
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Impossibile recuperare le chiavi di validazione"
            )
    
    return public_keys_cache


def get_public_key(token: str, jwks: dict):
    """Ottiene la chiave pubblica appropriata per validare il token"""
    try:
        # Decodifica l'header del token per ottenere il kid (key ID)
        unverified_header = jwt.get_unverified_header(token)
        kid = unverified_header.get("kid")
        
        # Trova la chiave corrispondente nel JWKS
        for key in jwks.get("keys", []):
            if key.get("kid") == kid:
                return key
    except Exception as e:
        print(f"Errore nel recupero della chiave pubblica: {e}")
        return None


async def verify_token(credentials: HTTPAuthorizationCredentials = Depends(security)) -> dict:
    """Verifica e decodifica il token JWT di Keycloak"""
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
        
        # Valida e decodifica il token
        payload = jwt.decode(
            token,
            pem_key,
            algorithms=["RS256"],
            audience=KEYCLOAK_CLIENT_ID,
            options={"verify_aud": True}
        )
        
        return payload
        
    except JWTError as e:
        print(f"Errore validazione JWT: {e}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token non valido o scaduto"
        )
    except Exception as e:
        print(f"Errore generico nella validazione: {e}")
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
        "sub": token_data.get("sub")
    }

