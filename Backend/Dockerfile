FROM python:3.11-slim

WORKDIR /app

# Installare dipendenze di sistema
RUN apt-get update && apt-get install -y \
    gcc \
    && rm -rf /var/lib/apt/lists/*

# Copiare requirements e installare dipendenze Python
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copiare il codice dell'applicazione
COPY . .

# Esporre la porta
EXPOSE 8000

# Comando di avvio (verrà sovrascritto da docker-compose per il reload)
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]

