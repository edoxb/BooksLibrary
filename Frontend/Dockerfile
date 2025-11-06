FROM node:20-alpine

WORKDIR /app

# Copiare package files
COPY package*.json ./

# Installare dipendenze
RUN npm install

# Copiare il resto del codice
COPY . .

# Esporre la porta di Vite
EXPOSE 5173

# Comando di avvio
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]
