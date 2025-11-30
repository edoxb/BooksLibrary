# Configurazione Traefik Dynamic

Questa directory contiene le configurazioni dinamiche di Traefik.

## Dashboard Authentication

La dashboard di Traefik è protetta con Basic Auth.

### Credenziali di default:
- **Username**: `admin`
- **Password**: `admin`

⚠️ **IMPORTANTE**: Cambia la password in produzione!

### Come cambiare la password:

1. Genera un nuovo hash della password:
```bash
docker run --rm httpd:2.4-alpine htpasswd -nbB username password
```

2. Sostituisci l'hash in `dashboard-auth.yml`:
```yaml
users:
  - "username:nuovo_hash_generato"
```

3. Riavvia Traefik:
```bash
docker compose restart traefik
```

### Accesso alla dashboard:

- URL: `http://traefik.localhost`
- La dashboard non è più accessibile su `http://localhost:8080` (per sicurezza)

