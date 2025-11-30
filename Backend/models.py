from datetime import date, datetime
from typing import Optional, List
from pydantic import BaseModel, Field, ConfigDict
from enum import Enum


class StatoLibro(str, Enum):
    pessimo = "pessimo"
    discreto = "discreto"
    buono = "buono"
    ottimo = "ottimo"


class LibroCreate(BaseModel):
    # Campi da Google Books
    titolo: str = Field(..., description="Titolo del libro")
    language: Optional[str] = Field(None, description="Lingua del libro")
    authors: Optional[List[str]] = Field(None, description="Lista degli autori")
    publisher: Optional[str] = Field(None, description="Editore del libro")
    isbn_10: Optional[str] = Field(None, description="ISBN-10 del libro")
    pageCount: Optional[int] = Field(None, description="Numero di pagine")
    thumbnail: Optional[str] = Field(None, description="URL dell'immagine thumbnail")
    publishedDate: Optional[str] = Field(None, description="Data di pubblicazione")
    categories: Optional[List[str]] = Field(None, description="Categorie del libro")
    
    # Campi aggiuntivi
    prenotazione: bool = Field(..., description="Stato prenotazione: True = disponibile, False = non disponibile")
    affittato_da: Optional[str] = Field(None, description="Nome e cognome di chi ha affittato il libro (obbligatorio se prenotazione=False)")
    data_restituzione: Optional[datetime] = Field(None, description="Data di restituzione (solo se prenotazione=False)")
    data_concessione: Optional[datetime] = Field(None, description="Data di concessione (solo se prenotazione=False)")
    stato_libro: StatoLibro = Field(..., description="Stato fisico del libro: pessimo, discreto, buono, ottimo")


class LibroUpdate(BaseModel):
    titolo: Optional[str] = None
    language: Optional[str] = None
    authors: Optional[List[str]] = None
    publisher: Optional[str] = None
    isbn_10: Optional[str] = None
    pageCount: Optional[int] = None
    thumbnail: Optional[str] = None
    publishedDate: Optional[str] = None
    categories: Optional[List[str]] = None
    prenotazione: Optional[bool] = None
    affittato_da: Optional[str] = None
    data_restituzione: Optional[datetime] = None
    data_concessione: Optional[datetime] = None
    stato_libro: Optional[StatoLibro] = None


class LibroResponse(BaseModel):
    model_config = ConfigDict(
        populate_by_name=True,
        arbitrary_types_allowed=True
    )
    
    id: str = Field(..., alias="_id")
    titolo: str
    language: Optional[str] = None
    authors: Optional[List[str]] = None
    publisher: Optional[str] = None
    isbn_10: Optional[str] = None
    pageCount: Optional[int] = None
    thumbnail: Optional[str] = None
    publishedDate: Optional[str] = None
    categories: Optional[List[str]] = None
    prenotazione: Optional[bool] = None  # Opzionale per retrocompatibilità
    affittato_da: Optional[str] = None
    data_restituzione: Optional[datetime] = None
    data_concessione: Optional[datetime] = None
    stato_libro: Optional[StatoLibro] = None  # Opzionale per retrocompatibilità

