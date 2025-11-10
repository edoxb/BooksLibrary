import os
from pymongo import MongoClient
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime
from contextlib import asynccontextmanager

# Configurazione MongoDB
MONGODB_URL = os.getenv("MONGODB_URL", "mongodb://admin:password123@mongodb:27017/bookslibrary?authSource=admin")
MONGODB_DB_NAME = os.getenv("MONGODB_DB_NAME", "bookslibrary")

# Client MongoDB globale
mongo_client: MongoClient = None
database = None
executor = ThreadPoolExecutor(max_workers=4)


def get_database():
    """Restituisce l'istanza del database"""
    return database


def get_executor():
    """Restituisce l'executor per operazioni asincrone"""
    return executor


def get_mongo_client():
    """Restituisce il client MongoDB"""
    return mongo_client


@asynccontextmanager
async def lifespan_manager(app):
    """Gestisce il ciclo di vita dell'applicazione (startup/shutdown)"""
    global mongo_client, database
    
    # Startup: connetti a MongoDB
    mongo_client = MongoClient(MONGODB_URL)
    database = mongo_client[MONGODB_DB_NAME]
    
    # Verifica connessione
    try:
        mongo_client.admin.command('ping')
        print("✅ Connesso a MongoDB con successo!")
    except Exception as e:
        print(f"❌ Errore connessione MongoDB: {e}")
    
    yield
    
    # Shutdown: chiudi connessione
    if mongo_client:
        mongo_client.close()
        print("🔌 Connessione MongoDB chiusa")


def convert_objectid(doc):
    """Funzione helper per convertire ObjectId in stringa e gestire le date"""
    if doc and "_id" in doc:
        doc["_id"] = str(doc["_id"])
    # Converti datetime in date se necessario
    if doc and "data_pubblicazione" in doc:
        if isinstance(doc["data_pubblicazione"], datetime):
            doc["data_pubblicazione"] = doc["data_pubblicazione"].date()
        elif isinstance(doc["data_pubblicazione"], str):
            # Se è già una stringa, prova a convertirla
            try:
                doc["data_pubblicazione"] = datetime.fromisoformat(doc["data_pubblicazione"]).date()
            except:
                pass
    return doc

