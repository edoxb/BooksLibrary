from datetime import date
from typing import Optional
from pydantic import BaseModel, Field, ConfigDict


class LibroCreate(BaseModel):
    titolo: str = Field(..., description="Titolo del libro")
    data_pubblicazione: date = Field(..., description="Data di pubblicazione")
    autore: str = Field(..., description="Autore del libro")
    genere: str = Field(..., description="Genere del libro")
    sottogenere: Optional[str] = Field(None, description="Sottogenere del libro")
    recensione: Optional[str] = Field(None, description="Recensione del libro")
    commento: Optional[str] = Field(None, description="Commento personale sul libro")
    immagine: Optional[str] = Field(None, description="URL dell'immagine del libro")


class LibroUpdate(BaseModel):
    titolo: Optional[str] = None
    data_pubblicazione: Optional[date] = None
    autore: Optional[str] = None
    genere: Optional[str] = None
    sottogenere: Optional[str] = None
    recensione: Optional[str] = None
    commento: Optional[str] = None
    immagine: Optional[str] = None


class LibroResponse(BaseModel):
    model_config = ConfigDict(
        populate_by_name=True,
        arbitrary_types_allowed=True
    )
    
    id: str = Field(..., alias="_id")
    titolo: str
    data_pubblicazione: date
    autore: str
    genere: str
    sottogenere: Optional[str] = None
    recensione: Optional[str] = None
    commento: Optional[str] = None
    immagine: Optional[str] = None

