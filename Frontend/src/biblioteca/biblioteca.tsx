import { useState, useEffect, useRef } from 'react'
import { MdQueryStats } from 'react-icons/md'

interface Libro {
  id: string
  titolo: string
  language?: string
  authors?: string[]
  publisher?: string
  isbn_10?: string
  pageCount?: number
  thumbnail?: string
  publishedDate?: string
  categories?: string[]
  prenotazione?: boolean
  affittato_da?: string
  data_restituzione?: string
  data_concessione?: string
  stato_libro?: 'pessimo' | 'discreto' | 'buono' | 'ottimo'
}

interface LibroFormData {
  titolo: string
  language: string
  authors: string
  publisher: string
  isbn_10: string
  pageCount: string
  thumbnail: string
  publishedDate: string
  categories: string
  prenotazione: boolean
  affittato_da: string
  data_restituzione: string
  data_concessione: string
  stato_libro: 'pessimo' | 'discreto' | 'buono' | 'ottimo'
}

interface BibliotecaProps {
  keycloak: any
  handleLogout: () => void
}

function Biblioteca({ keycloak, handleLogout }: BibliotecaProps) {
  const [libri, setLibri] = useState<Libro[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [formData, setFormData] = useState<LibroFormData>({
    titolo: '',
    language: '',
    authors: '',
    publisher: '',
    isbn_10: '',
    pageCount: '',
    thumbnail: '',
    publishedDate: '',
    categories: '',
    prenotazione: true,
    affittato_da: '',
    data_restituzione: '',
    data_concessione: '',
    stato_libro: 'buono'
  })
  const [submitting, setSubmitting] = useState(false)
  const [isAdmin, setIsAdmin] = useState(false)
  const [stats, setStats] = useState<{ total_libri: number; admin: string } | null>(null)
  const [loadingStats, setLoadingStats] = useState(false)
  const [showStats, setShowStats] = useState(false)
  const [showAvanzate, setShowAvanzate] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchDebounce, setSearchDebounce] = useState<ReturnType<typeof setTimeout> | null>(null)
  const [googleSearchQuery, setGoogleSearchQuery] = useState('')
  const [googleBooksResult, setGoogleBooksResult] = useState<any>(null)
  const [loadingGoogleBooks, setLoadingGoogleBooks] = useState(false)
  const [showGoogleBooksCarousel, setShowGoogleBooksCarousel] = useState(true)
  const carouselRef = useRef<HTMLDivElement>(null)

  // Recupera i ruoli dell'utente
  useEffect(() => {
    const fetchUserRoles = async () => {
      try {
        // Assicurati che il token sia valido prima di usarlo
        try {
          await keycloak.updateToken(30)
        } catch (error) {
          console.error('Errore nel rinnovo del token:', error)
          throw new Error('Impossibile rinnovare il token. Effettua nuovamente il login.')
        }
        
        // Ottieni il token di accesso
        const token = keycloak.token
        
        if (!token) {
          throw new Error('Token non disponibile. Effettua nuovamente il login.')
        }
        
        // Richiedi i ruoli dell'utente
        const response = await fetch('/api/user/roles', {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        })
        
        if (!response.ok) {
          if (response.status === 401) {
            // Token scaduto, prova a rinnovarlo
            try {
              await keycloak.updateToken(30)
              const newToken = keycloak.token
              if (!newToken) {
                throw new Error('Impossibile ottenere un nuovo token')
              }
              const retryResponse = await fetch('/api/user/roles', {
                headers: {
                  'Authorization': `Bearer ${newToken}`
                }
              })
              if (!retryResponse.ok) {
                console.error('Errore nel recupero dei ruoli')
                setIsAdmin(false)
                return
              }
              const retryData = await retryResponse.json()
              setIsAdmin(retryData.roles && retryData.roles.includes('admin'))
              return
            } catch (updateError) {
              console.error('Errore nel rinnovo del token:', updateError)
              setIsAdmin(false)
              return
            }
          }
          console.error('Errore nel recupero dei ruoli')
          setIsAdmin(false)
          return
        }
        
        const data = await response.json()
        setIsAdmin(data.roles && data.roles.includes('admin'))
      } catch (err) {
        console.error('Errore nel recupero dei ruoli:', err)
        setIsAdmin(false)
      }
    }

    fetchUserRoles()
  }, [keycloak])

  // Funzione per recuperare le statistiche dal backend
  const fetchStats = async () => {
    if (!isAdmin) {
      setStats(null)
      return
    }

    try {
      setLoadingStats(true)
      
      // Assicurati che il token sia valido prima di usarlo
      try {
        await keycloak.updateToken(30)
      } catch (error) {
        console.error('Errore nel rinnovo del token:', error)
        throw new Error('Impossibile rinnovare il token. Effettua nuovamente il login.')
      }
      
      // Ottieni il token di accesso
      const token = keycloak.token
      
      if (!token) {
        throw new Error('Token non disponibile. Effettua nuovamente il login.')
      }
      
      const response = await fetch('/api/admin/stats', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })
      
      if (!response.ok) {
        if (response.status === 401) {
          // Token scaduto, prova a rinnovarlo
          try {
            await keycloak.updateToken(30)
            const newToken = keycloak.token
            if (!newToken) {
              throw new Error('Impossibile ottenere un nuovo token')
            }
            const retryResponse = await fetch('/api/admin/stats', {
              headers: {
                'Authorization': `Bearer ${newToken}`
              }
            })
            if (!retryResponse.ok) {
              throw new Error('Errore nel recupero delle statistiche')
            }
            const retryData = await retryResponse.json()
            setStats(retryData)
            return
          } catch (updateError) {
            console.error('Errore nel rinnovo del token:', updateError)
            throw new Error('Token scaduto e impossibile rinnovarlo. Effettua nuovamente il login.')
          }
        }
        throw new Error('Errore nel recupero delle statistiche')
      }
      
      const data = await response.json()
      setStats(data)
    } catch (err) {
      console.error('Errore nel recupero delle statistiche:', err)
      setStats(null)
    } finally {
      setLoadingStats(false)
    }
  }

  // Funzione per cercare libri
  const searchLibri = async (query: string) => {
    if (!query || query.trim().length === 0) {
      setLibri([])
      setLoading(false)
      return
    }

      try {
        setLoading(true)
        setError(null)
        
        // Assicurati che il token sia valido prima di usarlo
        try {
          await keycloak.updateToken(30)
        } catch (error) {
          console.error('Errore nel rinnovo del token:', error)
          throw new Error('Impossibile rinnovare il token. Effettua nuovamente il login.')
        }
        
        // Ottieni il token di accesso
        const token = keycloak.token
        
        if (!token) {
          throw new Error('Token non disponibile. Effettua nuovamente il login.')
        }
        
      // Cerca libri usando l'endpoint di ricerca
      const encodedQuery = encodeURIComponent(query.trim())
      const response = await fetch(`/api/libri/search?q=${encodedQuery}`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        })
        
        if (!response.ok) {
          if (response.status === 401) {
            // Token scaduto, prova a rinnovarlo
            try {
              await keycloak.updateToken(30)
              const newToken = keycloak.token
              if (!newToken) {
                throw new Error('Impossibile ottenere un nuovo token')
              }
            const retryResponse = await fetch(`/api/libri/search?q=${encodedQuery}`, {
                headers: {
                  'Authorization': `Bearer ${newToken}`
                }
              })
              if (!retryResponse.ok) {
                const errorData = await retryResponse.json().catch(() => ({ detail: 'Errore sconosciuto' }))
                throw new Error(errorData.detail || `Errore HTTP: ${retryResponse.status}`)
              }
              const retryData = await retryResponse.json()
              setLibri(retryData)
              return
            } catch (updateError) {
              console.error('Errore nel rinnovo del token:', updateError)
              throw new Error('Token scaduto e impossibile rinnovarlo. Effettua nuovamente il login.')
            }
          }
          const errorData = await response.json().catch(() => ({ detail: 'Errore sconosciuto' }))
          throw new Error(errorData.detail || `Errore HTTP: ${response.status}`)
        }
        const data = await response.json()
        setLibri(data)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Errore sconosciuto')
      console.error('Errore nella ricerca dei libri:', err)
      } finally {
        setLoading(false)
      }
    }

  // Effetto per la ricerca con debounce
  useEffect(() => {
    // Pulisci il timeout precedente
    if (searchDebounce) {
      clearTimeout(searchDebounce)
    }

    // Se la query è vuota, non fare nulla
    if (!searchQuery || searchQuery.trim().length === 0) {
      setLibri([])
      setLoading(false)
      return
    }

    // Imposta un nuovo timeout per la ricerca
    setLoading(true)
    const timeout = setTimeout(() => {
      searchLibri(searchQuery)
    }, 500) // Debounce di 500ms

    setSearchDebounce(timeout)

    // Cleanup
    return () => {
      if (timeout) {
        clearTimeout(timeout)
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchQuery])

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target
    const checked = (e.target as HTMLInputElement).checked
    
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }))
  }

  // Funzione per precompilare il form con i dati di un libro Google Books
  const prefillFormFromGoogleBook = (item: any) => {
    const volumeInfo = item.volumeInfo || {}
    const imageLinks = volumeInfo.imageLinks || {}
    const industryIdentifiers = volumeInfo.industryIdentifiers || []
    const isbn10 = industryIdentifiers.find((id: any) => id.type === 'ISBN_10')
    const authors = volumeInfo.authors || []
    const categories = volumeInfo.categories || []

    setFormData({
      titolo: volumeInfo.title || '',
      language: volumeInfo.language || '',
      authors: authors.join(', ') || '',
      publisher: volumeInfo.publisher || '',
      isbn_10: isbn10?.identifier || '',
      pageCount: volumeInfo.pageCount ? volumeInfo.pageCount.toString() : '',
      thumbnail: imageLinks.thumbnail ? imageLinks.thumbnail.replace('http://', 'https://') : '',
      publishedDate: volumeInfo.publishedDate || '',
      categories: categories.join(', ') || '',
      prenotazione: true,
      affittato_da: '',
      data_restituzione: '',
      data_concessione: '',
      stato_libro: 'buono'
    })
    
    // Apri il form e scrolla verso di esso
    setShowForm(true)
    setTimeout(() => {
      const formElement = document.querySelector('.form-container')
      if (formElement) {
        formElement.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }
    }, 100)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    setError(null)

    try {
      // Prepara i dati per la chiamata POST
      const libroData: any = {
        titolo: formData.titolo,
        prenotazione: formData.prenotazione,
        stato_libro: formData.stato_libro
      }

      // Campi opzionali da Google Books
      if (formData.language.trim()) {
        libroData.language = formData.language.trim()
      }
      if (formData.authors.trim()) {
        libroData.authors = formData.authors.split(',').map(a => a.trim()).filter(a => a.length > 0)
      }
      if (formData.publisher.trim()) {
        libroData.publisher = formData.publisher.trim()
      }
      if (formData.isbn_10.trim()) {
        libroData.isbn_10 = formData.isbn_10.trim()
      }
      if (formData.pageCount.trim()) {
        const pageCount = parseInt(formData.pageCount)
        if (!isNaN(pageCount)) {
          libroData.pageCount = pageCount
        }
      }
      if (formData.thumbnail.trim()) {
        libroData.thumbnail = formData.thumbnail.trim()
      }
      if (formData.publishedDate.trim()) {
        libroData.publishedDate = formData.publishedDate.trim()
      }
      if (formData.categories.trim()) {
        libroData.categories = formData.categories.split(',').map(c => c.trim()).filter(c => c.length > 0)
      }

      // Campi condizionali per prenotazione
      if (!formData.prenotazione) {
        // affittato_da è obbligatorio quando il libro non è disponibile
        if (!formData.affittato_da.trim()) {
          throw new Error('Il campo "Nome e Cognome" è obbligatorio quando il libro non è disponibile')
        }
        libroData.affittato_da = formData.affittato_da.trim()
        
        if (formData.data_restituzione.trim()) {
          libroData.data_restituzione = formData.data_restituzione
        }
        if (formData.data_concessione.trim()) {
          libroData.data_concessione = formData.data_concessione
        }
      }

      // Assicurati che il token sia valido prima di usarlo
      try {
        await keycloak.updateToken(30)
      } catch (error) {
        console.error('Errore nel rinnovo del token:', error)
        throw new Error('Impossibile rinnovare il token. Effettua nuovamente il login.')
      }
      
      // Ottieni il token di accesso
      const token = keycloak.token
      
      if (!token) {
        throw new Error('Token non disponibile. Effettua nuovamente il login.')
      }
      
      const response = await fetch('/api/libri', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(libroData)
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ detail: 'Errore sconosciuto' }))
        throw new Error(errorData.detail || `Errore HTTP: ${response.status}`)
      }

      await response.json() // Libro creato con successo
      
      // Se c'è una ricerca attiva, ricarica i risultati
      // altrimenti aggiungi il nuovo libro alla lista solo se corrisponde alla ricerca
      if (searchQuery && searchQuery.trim().length > 0) {
        // Ricarica la ricerca per includere il nuovo libro se corrisponde
        await searchLibri(searchQuery)
      } else {
        // Se non c'è ricerca, non aggiungere nulla (non mostriamo libri senza ricerca)
        setLibri([])
      }
      
      // Reset del form
      setFormData({
        titolo: '',
        language: '',
        authors: '',
        publisher: '',
        isbn_10: '',
        pageCount: '',
        thumbnail: '',
        publishedDate: '',
        categories: '',
        prenotazione: true,
        affittato_da: '',
        data_restituzione: '',
        data_concessione: '',
        stato_libro: 'buono'
      })
      setShowForm(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Errore durante l\'aggiunta del libro')
      console.error('Errore nell\'aggiunta del libro:', err)
    } finally {
      setSubmitting(false)
    }
  }

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value)
  }

  const handleGoogleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setGoogleSearchQuery(e.target.value)
  }

  const handleGoogleSearchKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleGoogleSearchSubmit()
    }
  }

  // Funzione per cercare libri su Google Books tramite backend
  const searchGoogleBooks = async (query: string) => {
    if (!query || query.trim().length === 0) {
      setGoogleBooksResult(null)
      setLoadingGoogleBooks(false)
      return
    }

    try {
      setLoadingGoogleBooks(true)
      
      // Assicurati che il token sia valido prima di usarlo
      try {
        await keycloak.updateToken(30)
      } catch (error) {
        console.error('Errore nel rinnovo del token:', error)
        throw new Error('Impossibile rinnovare il token. Effettua nuovamente il login.')
      }
      
      // Ottieni il token di accesso
      const token = keycloak.token
      
      if (!token) {
        throw new Error('Token non disponibile. Effettua nuovamente il login.')
      }
      
      const encodedQuery = encodeURIComponent(query.trim())
      const response = await fetch(`/api/libri/google-books/search?q=${encodedQuery}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })
      
      if (!response.ok) {
        if (response.status === 401) {
          // Token scaduto, prova a rinnovarlo
          try {
            await keycloak.updateToken(30)
            const newToken = keycloak.token
            if (!newToken) {
              throw new Error('Impossibile ottenere un nuovo token')
            }
            const retryResponse = await fetch(`/api/libri/google-books/search?q=${encodedQuery}`, {
              headers: {
                'Authorization': `Bearer ${newToken}`
              }
            })
            if (!retryResponse.ok) {
              const errorData = await retryResponse.json().catch(() => ({ detail: 'Errore sconosciuto' }))
              throw new Error(errorData.detail || `Errore HTTP: ${retryResponse.status}`)
            }
            const retryData = await retryResponse.json()
            setGoogleBooksResult(retryData)
            return
          } catch (updateError) {
            console.error('Errore nel rinnovo del token:', updateError)
            throw new Error('Token scaduto e impossibile rinnovarlo. Effettua nuovamente il login.')
          }
        }
        const errorData = await response.json().catch(() => ({ detail: 'Errore sconosciuto' }))
        throw new Error(errorData.detail || `Errore HTTP: ${response.status}`)
      }
      
      const data = await response.json()
      setGoogleBooksResult(data)
      setShowGoogleBooksCarousel(true) // Mostra il carosello quando arrivano i risultati
    } catch (err) {
      console.error('Errore nella ricerca Google Books:', err)
      setGoogleBooksResult({ error: err instanceof Error ? err.message : 'Errore sconosciuto' })
    } finally {
      setLoadingGoogleBooks(false)
    }
  }

  const scrollCarousel = (direction: 'left' | 'right') => {
    if (carouselRef.current) {
      const scrollAmount = 300 // Pixel da scrollare
      const currentScroll = carouselRef.current.scrollLeft
      const newScroll = direction === 'left' 
        ? currentScroll - scrollAmount 
        : currentScroll + scrollAmount
      
      carouselRef.current.scrollTo({
        left: newScroll,
        behavior: 'smooth'
      })
    }
  }

  const handleGoogleSearchSubmit = () => {
    searchGoogleBooks(googleSearchQuery)
  }

  return (
    <div style={{ width: '100%' }}>
      {/* Header principale */}
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center', 
        marginBottom: '2rem',
        paddingBottom: '1rem',
        borderBottom: '2px solid #ddd'
      }}>
        <h1 style={{ 
          margin: 0, 
          fontSize: '2rem', 
          color: '#333',
          fontWeight: 'bold'
        }}>
          Biblioteca privata C.R.A.L
        </h1>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          {isAdmin && !showStats && (
            <button
              onClick={async () => {
                setShowStats(true)
                await fetchStats()
              }}
              style={{
                padding: '0.5rem 1rem',
                fontSize: '0.9rem',
                cursor: 'pointer',
                backgroundColor: '#2196F3',
                border: 'none',
                borderRadius: '4px',
                color: 'white',
                fontWeight: 'bold',
                transition: 'all 0.3s',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = '#1976D2'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = '#2196F3'
              }}
              title="Mostra Statistiche"
            >
              <MdQueryStats size={18} />
              <span>Mostra Statistiche</span>
            </button>
          )}
          {keycloak.tokenParsed && (
            <span style={{ fontSize: '0.9rem', color: '#666' }}>
              👤 {keycloak.tokenParsed.preferred_username || keycloak.tokenParsed.name || 'Utente'}
            </span>
          )}
          {isAdmin && (
            <button
              onClick={() => setShowAvanzate(!showAvanzate)}
              style={{
                padding: '0.5rem 1rem',
                fontSize: '0.9rem',
                cursor: 'pointer',
                backgroundColor: showAvanzate ? '#ff9800' : '#9C27B0',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                fontWeight: 'bold',
                transition: 'all 0.3s'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = showAvanzate ? '#f57c00' : '#7B1FA2'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = showAvanzate ? '#ff9800' : '#9C27B0'
              }}
              title="Opzioni Avanzate"
            >
              ⚙️ Avanzate
            </button>
          )}
          <button
            onClick={handleLogout}
            style={{
              padding: '0.5rem 1rem',
              fontSize: '0.9rem',
              cursor: 'pointer',
              backgroundColor: '#f44336',
              color: 'white',
              border: 'none',
              borderRadius: '4px'
            }}
          >
            🚪 Esci
          </button>
        </div>
      </div>

      {/* Barra di ricerca */}
      <div style={{ 
        marginBottom: '2rem', 
        padding: '1rem', 
        backgroundColor: '#f5f5f5', 
        borderRadius: '8px',
        width: '100%',
        boxSizing: 'border-box'
      }}>
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
          <label htmlFor="search-input" style={{ 
            fontSize: '1.1rem', 
            fontWeight: 'bold', 
            color: '#333',
            whiteSpace: 'nowrap'
          }}>
            🔍 Cerca Libri nell'Archivio CRAL
          </label>
          <input
            id="search-input"
            type="text"
            value={searchQuery}
            onChange={handleSearchChange}
            placeholder="Cerca per titolo, autori, editore, categorie, lingua o ISBN..."
            style={{ 
              flex: 1, 
              padding: '0.75rem 1rem', 
              fontSize: '1rem', 
              borderRadius: '6px', 
              border: '2px solid #ddd',
              outline: 'none',
              transition: 'border-color 0.3s'
            }}
            onFocus={(e) => {
              e.target.style.borderColor = '#2196F3'
            }}
            onBlur={(e) => {
              e.target.style.borderColor = '#ddd'
            }}
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              style={{
                padding: '0.5rem 1rem',
                fontSize: '0.9rem',
                cursor: 'pointer',
                backgroundColor: '#f44336',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                fontWeight: 'bold'
              }}
            >
              ✕ Pulisci
            </button>
          )}
        </div>
        {!searchQuery && (
          <p style={{ 
            marginTop: '0.5rem', 
            color: '#666', 
            fontSize: '0.9rem',
            fontStyle: 'italic'
          }}>
            Inserisci almeno un carattere per iniziare la ricerca
          </p>
        )}
      </div>

      {/* Barra di ricerca Google Books - Solo Admin */}
      {isAdmin && (
        <div style={{ 
          marginBottom: '2rem', 
          padding: '1rem', 
          backgroundColor: '#f5f5f5', 
          borderRadius: '8px',
          width: '100%',
          boxSizing: 'border-box'
        }}>
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
          <label htmlFor="google-search-input" style={{ 
            fontSize: '1.1rem', 
            fontWeight: 'bold', 
            color: '#333',
            whiteSpace: 'nowrap'
          }}>
            🔍 Cerca Libri Online
          </label>
          <input
            id="google-search-input"
            type="text"
            value={googleSearchQuery}
            onChange={handleGoogleSearchChange}
            onKeyPress={handleGoogleSearchKeyPress}
            placeholder="Cerca libri su Google Books..."
            style={{ 
              flex: 1, 
              padding: '0.75rem 1rem', 
              fontSize: '1rem', 
              borderRadius: '6px', 
              border: '2px solid #ddd',
              outline: 'none',
              transition: 'border-color 0.3s'
            }}
            onFocus={(e) => {
              e.target.style.borderColor = '#2196F3'
            }}
            onBlur={(e) => {
              e.target.style.borderColor = '#ddd'
            }}
          />
          <button
            onClick={handleGoogleSearchSubmit}
            disabled={loadingGoogleBooks || !googleSearchQuery.trim()}
            style={{
              padding: '0.75rem 1.5rem',
              fontSize: '1rem',
              cursor: loadingGoogleBooks || !googleSearchQuery.trim() ? 'not-allowed' : 'pointer',
              backgroundColor: loadingGoogleBooks || !googleSearchQuery.trim() ? '#ccc' : '#4CAF50',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              fontWeight: 'bold',
              transition: 'all 0.3s',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem'
            }}
            onMouseEnter={(e) => {
              if (!loadingGoogleBooks && googleSearchQuery.trim()) {
                e.currentTarget.style.backgroundColor = '#45a049'
              }
            }}
            onMouseLeave={(e) => {
              if (!loadingGoogleBooks && googleSearchQuery.trim()) {
                e.currentTarget.style.backgroundColor = '#4CAF50'
              }
            }}
          >
            {loadingGoogleBooks ? '⏳' : '🔍'} Invio
          </button>
        </div>
        {!googleSearchQuery && (
          <p style={{ 
            marginTop: '0.5rem', 
            color: '#666', 
            fontSize: '0.9rem',
            fontStyle: 'italic'
          }}>
            Inserisci almeno un carattere per cercare libri su Google Books
          </p>
        )}
        </div>
      )}

      {/* Risultati Google Books - Carosello - Solo Admin */}
      {isAdmin && (
        <>
          {loadingGoogleBooks && (
            <div style={{ 
              padding: '2rem', 
              textAlign: 'center', 
              color: '#666',
              fontSize: '1rem'
            }}>
              Caricamento risultati da Google Books...
            </div>
          )}
          
          {!loadingGoogleBooks && googleBooksResult && googleBooksResult.items && googleBooksResult.items.length > 0 && showGoogleBooksCarousel && (
            <div style={{ 
          marginBottom: '2rem', 
          padding: '1.5rem', 
          backgroundColor: '#f9f9f9', 
          border: '1px solid #ddd',
          borderRadius: '8px',
          width: '100%',
          boxSizing: 'border-box',
          position: 'relative'
        }}>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '1.5rem'
          }}>
            <h3 style={{ 
              margin: 0, 
              color: '#333',
              fontSize: '1.5rem',
              fontWeight: 'bold'
            }}>
              📚 Risultati ricerca: {googleBooksResult.items.length} {googleBooksResult.items.length === 1 ? 'libro trovato' : 'libri trovati'}
            </h3>
            <button
              onClick={() => setShowGoogleBooksCarousel(false)}
              style={{
                padding: '0.5rem',
                fontSize: '1.5rem',
                cursor: 'pointer',
                backgroundColor: 'transparent',
                border: 'none',
                borderRadius: '4px',
                color: '#d32f2f',
                fontWeight: 'bold',
                transition: 'all 0.3s',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '36px',
                height: '36px'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = '#ffebee'
                e.currentTarget.style.color = '#c62828'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'transparent'
                e.currentTarget.style.color = '#d32f2f'
              }}
              title="Chiudi carosello"
            >
              ✕
            </button>
          </div>
          
          {/* Container carosello con frecce */}
          <div style={{ position: 'relative' }}>
            {/* Freccia sinistra */}
            <button
              onClick={() => scrollCarousel('left')}
              style={{
                position: 'absolute',
                left: '-20px',
                top: '50%',
                transform: 'translateY(-50%)',
                zIndex: 10,
                width: '40px',
                height: '40px',
                borderRadius: '50%',
                backgroundColor: '#fff',
                border: '2px solid #2196F3',
                color: '#2196F3',
                fontSize: '1.5rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
                transition: 'all 0.3s'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = '#2196F3'
                e.currentTarget.style.color = '#fff'
                e.currentTarget.style.transform = 'translateY(-50%) scale(1.1)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = '#fff'
                e.currentTarget.style.color = '#2196F3'
                e.currentTarget.style.transform = 'translateY(-50%) scale(1)'
              }}
              title="Scorri a sinistra"
            >
              ‹
            </button>

            {/* Freccia destra */}
            <button
              onClick={() => scrollCarousel('right')}
              style={{
                position: 'absolute',
                right: '-20px',
                top: '50%',
                transform: 'translateY(-50%)',
                zIndex: 10,
                width: '40px',
                height: '40px',
                borderRadius: '50%',
                backgroundColor: '#fff',
                border: '2px solid #2196F3',
                color: '#2196F3',
                fontSize: '1.5rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
                transition: 'all 0.3s'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = '#2196F3'
                e.currentTarget.style.color = '#fff'
                e.currentTarget.style.transform = 'translateY(-50%) scale(1.1)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = '#fff'
                e.currentTarget.style.color = '#2196F3'
                e.currentTarget.style.transform = 'translateY(-50%) scale(1)'
              }}
              title="Scorri a destra"
            >
              ›
            </button>
          
            {/* Carosello */}
            <div 
              ref={carouselRef}
              style={{
                display: 'flex',
                gap: '1.5rem',
                overflowX: 'hidden',
                paddingBottom: '1rem',
                scrollBehavior: 'smooth',
                WebkitOverflowScrolling: 'touch'
              }}
            >
            {googleBooksResult.items.map((item: any, index: number) => {
              const volumeInfo = item.volumeInfo || {}
              const imageLinks = volumeInfo.imageLinks || {}
              const industryIdentifiers = volumeInfo.industryIdentifiers || []
              const isbn10 = industryIdentifiers.find((id: any) => id.type === 'ISBN_10')
              const authors = volumeInfo.authors || []
              
              return (
                <div
                  key={item.id || index}
                  style={{
                    minWidth: '280px',
                    maxWidth: '280px',
                    backgroundColor: '#fff',
                    borderRadius: '8px',
                    padding: '1rem',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                    display: 'flex',
                    flexDirection: 'column',
                    transition: 'transform 0.2s, box-shadow 0.2s'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = 'translateY(-4px)'
                    e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.15)'
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = 'translateY(0)'
                    e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.1)'
                  }}
                >
                  {/* Immagine */}
                  {imageLinks.thumbnail && (
                    <div style={{ 
                      width: '100%', 
                      height: '200px', 
                      marginBottom: '1rem',
                      borderRadius: '4px',
                      overflow: 'hidden',
                      backgroundColor: '#f0f0f0',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}>
                      <img 
                        src={imageLinks.thumbnail.replace('http://', 'https://')} 
                        alt={volumeInfo.title || 'Copertina libro'}
                        style={{ 
                          width: '100%', 
                          height: '100%', 
                          objectFit: 'cover'
                        }}
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = 'none'
                        }}
                      />
                    </div>
                  )}
                  
                  {/* Titolo */}
                  <h4 style={{ 
                    margin: '0 0 0.5rem 0',
                    fontSize: '1.1rem',
                    fontWeight: 'bold',
                    color: '#1976d2',
                    lineHeight: '1.3',
                    minHeight: '2.6rem',
                    display: '-webkit-box',
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: 'vertical',
                    overflow: 'hidden'
                  }}>
                    {volumeInfo.title || 'Titolo non disponibile'}
                  </h4>
                  
                  {/* Autori */}
                  {authors.length > 0 && (
                    <p style={{ 
                      margin: '0 0 0.5rem 0',
                      fontSize: '0.9rem',
                      color: '#666',
                      fontStyle: 'italic'
                    }}>
                      <strong>Autore:</strong> {authors.join(', ')}
                    </p>
                  )}
                  
                  {/* Editore */}
                  {volumeInfo.publisher && (
                    <p style={{ 
                      margin: '0 0 0.5rem 0',
                      fontSize: '0.85rem',
                      color: '#555'
                    }}>
                      <strong>Editore:</strong> {volumeInfo.publisher}
                    </p>
                  )}
                  
                  {/* Lingua */}
                  {volumeInfo.language && (
                    <p style={{ 
                      margin: '0 0 0.5rem 0',
                      fontSize: '0.85rem',
                      color: '#555'
                    }}>
                      <strong>Lingua:</strong> {volumeInfo.language.toUpperCase()}
                    </p>
                  )}
                  
                  {/* Data pubblicazione */}
                  {volumeInfo.publishedDate && (
                    <p style={{ 
                      margin: '0 0 0.5rem 0',
                      fontSize: '0.85rem',
                      color: '#555'
                    }}>
                      <strong>Data pubblicazione:</strong> {volumeInfo.publishedDate}
                    </p>
                  )}
                  
                  {/* Categorie */}
                  {volumeInfo.categories && volumeInfo.categories.length > 0 && (
                    <p style={{ 
                      margin: '0 0 0.5rem 0',
                      fontSize: '0.85rem',
                      color: '#555'
                    }}>
                      <strong>Categorie:</strong> {volumeInfo.categories.join(', ')}
                    </p>
                  )}
                  
                  {/* ISBN-10 */}
                  {isbn10 && (
                    <p style={{ 
                      margin: '0 0 0.5rem 0',
                      fontSize: '0.85rem',
                      color: '#555'
                    }}>
                      <strong>ISBN-10:</strong> {isbn10.identifier}
                    </p>
                  )}
                  
                  {/* Pagine */}
                  {volumeInfo.pageCount && (
                    <p style={{ 
                      margin: '0 0 1rem 0',
                      fontSize: '0.85rem',
                      color: '#555'
                    }}>
                      <strong>Pagine:</strong> {volumeInfo.pageCount}
                    </p>
                  )}

                  {/* Pulsante Aggiungi al Database */}
      {isAdmin && (
                    <button
                      onClick={() => prefillFormFromGoogleBook(item)}
                      style={{
                        marginTop: 'auto',
                        padding: '0.75rem 1rem',
                        fontSize: '0.9rem',
                        cursor: 'pointer',
                        backgroundColor: '#4CAF50',
                        color: 'white',
                        border: 'none',
                        borderRadius: '6px',
                        fontWeight: 'bold',
                        transition: 'all 0.3s',
                        width: '100%'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = '#45a049'
                        e.currentTarget.style.transform = 'translateY(-2px)'
                        e.currentTarget.style.boxShadow = '0 4px 8px rgba(0,0,0,0.2)'
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = '#4CAF50'
                        e.currentTarget.style.transform = 'translateY(0)'
                        e.currentTarget.style.boxShadow = 'none'
                      }}
                      title="Aggiungi questo libro al database"
                    >
                      ➕ Aggiungi al Database
                    </button>
                  )}
                </div>
              )
            })}
            </div>
          </div>
        </div>
          )}
          
          {!loadingGoogleBooks && googleBooksResult && (!googleBooksResult.items || googleBooksResult.items.length === 0) && (
            <div style={{ 
              padding: '2rem', 
              textAlign: 'center', 
              color: '#666',
              fontSize: '1rem',
              backgroundColor: '#f9f9f9',
              borderRadius: '8px',
              border: '1px solid #ddd'
            }}>
              Nessun libro trovato per la ricerca effettuata
            </div>
          )}
          
          {!loadingGoogleBooks && googleBooksResult && googleBooksResult.error && (
            <div style={{ 
              padding: '2rem', 
              textAlign: 'center', 
              color: '#d32f2f',
              fontSize: '1rem',
              backgroundColor: '#ffebee',
              borderRadius: '8px',
              border: '1px solid #d32f2f'
            }}>
              Errore: {googleBooksResult.error}
            </div>
          )}
        </>
      )}

      {/* Sezione Avanzate */}
      {isAdmin && showAvanzate && (
        <div style={{ 
          marginBottom: '2rem', 
          padding: '1.5rem', 
          border: '2px solid #9C27B0', 
          borderRadius: '8px',
          backgroundColor: '#F3E5F5',
          width: '100%',
          boxSizing: 'border-box'
        }}>
          <div style={{ 
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'center',
            marginBottom: '1rem'
          }}>
            <h2 style={{ marginTop: 0, color: '#7B1FA2' }}>⚙️ Opzioni Avanzate</h2>
            <button
              onClick={() => setShowAvanzate(false)}
              style={{
                padding: '0.5rem',
                fontSize: '1.5rem',
                cursor: 'pointer',
                backgroundColor: 'transparent',
                border: 'none',
                borderRadius: '4px',
                color: '#d32f2f',
                fontWeight: 'bold',
                transition: 'all 0.3s',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '36px',
                height: '36px'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = '#ffebee'
                e.currentTarget.style.color = '#c62828'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'transparent'
                e.currentTarget.style.color = '#d32f2f'
              }}
              title="Chiudi opzioni avanzate"
            >
              ✕
            </button>
          </div>
          
          {/* Pulsante per cancellare tutti i libri */}
          <button
            onClick={async () => {
              if (window.confirm('Sei sicuro di voler cancellare TUTTI i libri dal database? Questa operazione non può essere annullata.')) {
                try {
                  await keycloak.updateToken(30)
                  const token = keycloak.token
                  
                  if (!token) {
                    throw new Error('Token non disponibile')
                  }
                  
                  const response = await fetch('/api/admin/libri/all', {
                    method: 'DELETE',
                    headers: {
                      'Authorization': `Bearer ${token}`
                    }
                  })
                  
                  if (!response.ok) {
                    const errorData = await response.json().catch(() => ({ detail: 'Errore sconosciuto' }))
                    throw new Error(errorData.detail || `Errore HTTP: ${response.status}`)
                  }
                  
                  const result = await response.json()
                  alert(`Cancellati ${result.libri_cancellati} libri dal database`)
                  
                  // Pulisci la ricerca
                  setSearchQuery('')
                  setLibri([])
                } catch (err) {
                  alert(err instanceof Error ? err.message : 'Errore durante la cancellazione')
                  console.error('Errore nella cancellazione:', err)
                }
              }
            }}
            style={{ 
              padding: '0.75rem 1.5rem', 
              fontSize: '1rem',
              cursor: 'pointer',
              backgroundColor: '#f44336',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              fontWeight: 'bold',
              transition: 'all 0.3s'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = '#d32f2f'
              e.currentTarget.style.transform = 'translateY(-2px)'
              e.currentTarget.style.boxShadow = '0 4px 8px rgba(0,0,0,0.2)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = '#f44336'
              e.currentTarget.style.transform = 'translateY(0)'
              e.currentTarget.style.boxShadow = 'none'
            }}
            title="Cancella tutti i libri dal database"
          >
            🗑️ Cancella Tutti i Libri
          </button>
        </div>
      )}

      {isAdmin && (
        <>
          {/* Blocco statistiche - visibile solo se showStats è true */}
          {showStats && (
            <div style={{ 
              marginBottom: '2rem', 
              padding: '1.5rem', 
              border: '2px solid #2196F3', 
              borderRadius: '8px',
              backgroundColor: '#E3F2FD',
              width: '100%',
              boxSizing: 'border-box'
            }}>
              <div style={{ 
                display: 'flex', 
                justifyContent: 'space-between', 
                alignItems: 'center',
                marginBottom: '1rem'
              }}>
                <h2 style={{ marginTop: 0, color: '#1976D2' }}>📊 Statistiche Amministratore</h2>
                <button
                  onClick={() => setShowStats(false)}
                  style={{
                    padding: '0.5rem',
                    fontSize: '1.5rem',
                    cursor: 'pointer',
                    backgroundColor: 'transparent',
                    border: 'none',
                    borderRadius: '4px',
                    color: '#d32f2f',
                    fontWeight: 'bold',
                    transition: 'all 0.3s',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: '36px',
                    height: '36px'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = '#ffebee'
                    e.currentTarget.style.color = '#c62828'
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'transparent'
                    e.currentTarget.style.color = '#d32f2f'
                  }}
                  title="Chiudi statistiche"
                >
                  ✕
                </button>
              </div>
              {loadingStats ? (
                <p>Caricamento statistiche...</p>
              ) : stats ? (
                <div style={{ display: 'flex', gap: '2rem', flexWrap: 'wrap' }}>
                  <div style={{ 
                    padding: '1rem', 
                    backgroundColor: 'white', 
                    borderRadius: '6px',
                    boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                    minWidth: '200px'
                  }}>
                    <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#1976D2', marginBottom: '0.5rem' }}>
                      {stats.total_libri}
                    </div>
                    <div style={{ color: '#666', fontSize: '0.9rem' }}>Libri Totali</div>
                  </div>
                  <div style={{ 
                    padding: '1rem', 
                    backgroundColor: 'white', 
                    borderRadius: '6px',
                    boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                    minWidth: '200px'
                  }}>
                    <div style={{ fontSize: '1.2rem', fontWeight: 'bold', color: '#1976D2', marginBottom: '0.5rem' }}>
                      {stats.admin}
                    </div>
                    <div style={{ color: '#666', fontSize: '0.9rem' }}>Amministratore</div>
                  </div>
                </div>
              ) : (
                <p style={{ color: '#d32f2f' }}>Errore nel caricamento delle statistiche</p>
              )}
            </div>
          )}
          
        <button 
          onClick={() => setShowForm(!showForm)}
          style={{ 
            marginBottom: '1rem', 
            padding: '0.5rem 1rem', 
            fontSize: '1rem',
            cursor: 'pointer',
            backgroundColor: '#4CAF50',
            color: 'white',
            border: 'none',
            borderRadius: '4px'
          }}
        >
          {showForm ? '❌ Annulla' : '➕ Aggiungi Libro'}
        </button>
        </>
      )}

      {showForm && (
        <div className="form-container" style={{ 
          marginBottom: '2rem', 
          padding: '1.5rem', 
          border: '1px solid #ddd', 
          borderRadius: '8px',
          backgroundColor: '#f9f9f9',
          width: '100%',
          boxSizing: 'border-box'
        }}>
          <h2>Aggiungi Nuovo Libro</h2>
          <form onSubmit={handleSubmit}>
            {/* Titolo - Obbligatorio */}
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>
                Titolo *
              </label>
              <input
                type="text"
                name="titolo"
                value={formData.titolo}
                onChange={handleInputChange}
                required
                style={{ width: '100%', padding: '0.5rem', fontSize: '1rem', borderRadius: '4px', border: '1px solid #ddd' }}
              />
            </div>

            {/* Autori */}
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>
                Autori (separati da virgola)
              </label>
              <input
                type="text"
                name="authors"
                value={formData.authors}
                onChange={handleInputChange}
                placeholder="Autore 1, Autore 2, ..."
                style={{ width: '100%', padding: '0.5rem', fontSize: '1rem', borderRadius: '4px', border: '1px solid #ddd' }}
              />
            </div>

            {/* Editore */}
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>
                Editore
              </label>
              <input
                type="text"
                name="publisher"
                value={formData.publisher}
                onChange={handleInputChange}
                style={{ width: '100%', padding: '0.5rem', fontSize: '1rem', borderRadius: '4px', border: '1px solid #ddd' }}
              />
            </div>

            {/* Lingua */}
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>
                Lingua
              </label>
              <input
                type="text"
                name="language"
                value={formData.language}
                onChange={handleInputChange}
                placeholder="it, en, fr, ..."
                style={{ width: '100%', padding: '0.5rem', fontSize: '1rem', borderRadius: '4px', border: '1px solid #ddd' }}
              />
            </div>

            {/* Data pubblicazione */}
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>
                Data Pubblicazione
              </label>
              <input
                type="text"
                name="publishedDate"
                value={formData.publishedDate}
                onChange={handleInputChange}
                placeholder="2024 o 2024-01-15"
                style={{ width: '100%', padding: '0.5rem', fontSize: '1rem', borderRadius: '4px', border: '1px solid #ddd' }}
              />
            </div>

            {/* Categorie */}
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>
                Categorie (separate da virgola)
              </label>
              <input
                type="text"
                name="categories"
                value={formData.categories}
                onChange={handleInputChange}
                placeholder="Fiction, Science Fiction, ..."
                style={{ width: '100%', padding: '0.5rem', fontSize: '1rem', borderRadius: '4px', border: '1px solid #ddd' }}
              />
            </div>

            {/* ISBN-10 */}
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>
                ISBN-10
              </label>
              <input
                type="text"
                name="isbn_10"
                value={formData.isbn_10}
                onChange={handleInputChange}
                style={{ width: '100%', padding: '0.5rem', fontSize: '1rem', borderRadius: '4px', border: '1px solid #ddd' }}
              />
            </div>

            {/* Numero pagine */}
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>
                Numero Pagine
              </label>
              <input
                type="number"
                name="pageCount"
                value={formData.pageCount}
                onChange={handleInputChange}
                min="1"
                style={{ width: '100%', padding: '0.5rem', fontSize: '1rem', borderRadius: '4px', border: '1px solid #ddd' }}
              />
            </div>

            {/* URL Immagine */}
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>
                URL Immagine (Thumbnail)
              </label>
              <input
                type="url"
                name="thumbnail"
                value={formData.thumbnail}
                onChange={handleInputChange}
                placeholder="https://example.com/copertina.jpg"
                style={{ width: '100%', padding: '0.5rem', fontSize: '1rem', borderRadius: '4px', border: '1px solid #ddd' }}
              />
            </div>

            {/* Stato Libro - Enum */}
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>
                Stato del Libro *
              </label>
              <select
                name="stato_libro"
                value={formData.stato_libro}
                onChange={handleInputChange}
                required
                style={{ width: '100%', padding: '0.5rem', fontSize: '1rem', borderRadius: '4px', border: '1px solid #ddd' }}
              >
                <option value="pessimo">Pessimo</option>
                <option value="discreto">Discreto</option>
                <option value="buono">Buono</option>
                <option value="ottimo">Ottimo</option>
              </select>
            </div>

            {/* Prenotazione - Checkbox */}
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 'bold', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  name="prenotazione"
                  checked={formData.prenotazione}
                  onChange={handleInputChange}
                  style={{ width: '20px', height: '20px', cursor: 'pointer' }}
                />
                <span>Disponibile (se deselezionato = Non disponibile) *</span>
              </label>
            </div>

            {/* Nome e Cognome - Obbligatorio se non disponibile */}
            {!formData.prenotazione && (
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>
                  Nome e Cognome (chi ha affittato) *
              </label>
                <input
                  type="text"
                  name="affittato_da"
                  value={formData.affittato_da}
                onChange={handleInputChange}
                  required={!formData.prenotazione}
                  placeholder="Mario Rossi"
                  style={{ width: '100%', padding: '0.5rem', fontSize: '1rem', borderRadius: '4px', border: '1px solid #ddd' }}
              />
            </div>
            )}

            {/* Data Concessione - Solo se non disponibile */}
            {!formData.prenotazione && (
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>
                  Data Concessione
                </label>
                <input
                  type="datetime-local"
                  name="data_concessione"
                  value={formData.data_concessione}
                  onChange={handleInputChange}
                  style={{ width: '100%', padding: '0.5rem', fontSize: '1rem', borderRadius: '4px', border: '1px solid #ddd' }}
                />
              </div>
            )}

            {/* Data Restituzione - Solo se non disponibile */}
            {!formData.prenotazione && (
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>
                  Data Restituzione
                </label>
                <input
                  type="datetime-local"
                  name="data_restituzione"
                  value={formData.data_restituzione}
                  onChange={handleInputChange}
                  style={{ width: '100%', padding: '0.5rem', fontSize: '1rem', borderRadius: '4px', border: '1px solid #ddd' }}
                />
              </div>
            )}

            <button
              type="submit"
              disabled={submitting}
              style={{
                padding: '0.75rem 1.5rem',
                fontSize: '1rem',
                cursor: submitting ? 'not-allowed' : 'pointer',
                backgroundColor: submitting ? '#ccc' : '#4CAF50',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                fontWeight: 'bold'
              }}
            >
              {submitting ? 'Salvataggio...' : 'Salva Libro'}
            </button>
          </form>
        </div>
      )}
      
      {loading && <p>Caricamento libri...</p>}
      {error && <p className="error">Errore: {error}</p>}
      
      {!loading && !error && (
        <>
          {!searchQuery || searchQuery.trim().length === 0 ? (
            <div style={{ 
              textAlign: 'center', 
              padding: '3rem', 
              color: '#666',
              fontSize: '1.1rem'
            }}>
              <p>🔍 Inserisci una parola chiave nella barra di ricerca per cercare libri</p>
              <p style={{ fontSize: '0.9rem', marginTop: '0.5rem' }}>
                La ricerca funziona su titolo, autore, genere, sottogenere, recensione e commento
              </p>
            </div>
          ) : libri.length === 0 ? (
            <div style={{ 
              textAlign: 'center', 
              padding: '3rem', 
              color: '#666',
              fontSize: '1.1rem'
            }}>
              <p>📚 Nessun libro trovato per "{searchQuery}"</p>
              <p style={{ fontSize: '0.9rem', marginTop: '0.5rem' }}>
                Prova con un termine di ricerca diverso
              </p>
            </div>
          ) : (
            <div style={{ 
              marginBottom: '2rem', 
              padding: '1.5rem', 
              backgroundColor: '#f9f9f9', 
              border: '1px solid #ddd',
              borderRadius: '8px',
              width: '100%',
              boxSizing: 'border-box'
            }}>
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '1.5rem'
              }}>
                <h3 style={{ 
                  margin: 0, 
                  color: '#333',
                  fontSize: '1.5rem',
                  fontWeight: 'bold'
                }}>
                  📚 Risultati ricerca: {libri.length} {libri.length === 1 ? 'libro trovato' : 'libri trovati'} per "{searchQuery}"
                </h3>
              </div>
              
              {/* Carosello libri DB */}
              <div style={{
                display: 'flex',
                gap: '1.5rem',
                overflowX: 'auto',
                paddingBottom: '1rem',
                scrollBehavior: 'smooth',
                WebkitOverflowScrolling: 'touch'
              }}>
                {libri.map((libro, index) => (
                  <div
                    key={libro.id || `libro-${index}`}
                    style={{
                      minWidth: '280px',
                      maxWidth: '280px',
                      backgroundColor: '#fff',
                      borderRadius: '8px',
                      padding: '1rem',
                      boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                      display: 'flex',
                      flexDirection: 'column',
                      transition: 'transform 0.2s, box-shadow 0.2s'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.transform = 'translateY(-4px)'
                      e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.15)'
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.transform = 'translateY(0)'
                      e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.1)'
                    }}
                  >
                    {/* Immagine */}
                    {libro.thumbnail && (
                      <div style={{ 
                        width: '100%', 
                        height: '200px', 
                        marginBottom: '1rem',
                        borderRadius: '4px',
                        overflow: 'hidden',
                        backgroundColor: '#f0f0f0',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                      }}>
                        <img 
                          src={libro.thumbnail.replace('http://', 'https://')} 
                          alt={libro.titolo || 'Copertina libro'}
                          style={{ 
                            width: '100%', 
                            height: '100%', 
                            objectFit: 'cover'
                          }}
                          onError={(e) => {
                            (e.target as HTMLImageElement).style.display = 'none'
                          }}
                        />
                      </div>
                    )}
                    
                    {/* Titolo */}
                    <h4 style={{ 
                      margin: '0 0 0.5rem 0',
                      fontSize: '1.1rem',
                      fontWeight: 'bold',
                      color: '#1976d2',
                      lineHeight: '1.3',
                      minHeight: '2.6rem',
                      display: '-webkit-box',
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: 'vertical',
                      overflow: 'hidden'
                    }}>
                      {libro.titolo || 'Titolo non disponibile'}
                    </h4>
                    
                    {/* Autori */}
                    {libro.authors && libro.authors.length > 0 && (
                      <p style={{ 
                        margin: '0 0 0.5rem 0',
                        fontSize: '0.9rem',
                        color: '#666',
                        fontStyle: 'italic'
                      }}>
                        <strong>Autore:</strong> {Array.isArray(libro.authors) ? libro.authors.join(', ') : libro.authors}
                      </p>
                    )}
                    
                    {/* Editore */}
                    {libro.publisher && (
                      <p style={{ 
                        margin: '0 0 0.5rem 0',
                        fontSize: '0.85rem',
                        color: '#555'
                      }}>
                        <strong>Editore:</strong> {libro.publisher}
                      </p>
                    )}
                    
                    {/* Lingua */}
                    {libro.language && (
                      <p style={{ 
                        margin: '0 0 0.5rem 0',
                        fontSize: '0.85rem',
                        color: '#555'
                      }}>
                        <strong>Lingua:</strong> {libro.language.toUpperCase()}
                      </p>
                    )}
                    
                    {/* Data pubblicazione */}
                    {libro.publishedDate && (
                      <p style={{ 
                        margin: '0 0 0.5rem 0',
                        fontSize: '0.85rem',
                        color: '#555'
                      }}>
                        <strong>Data pubblicazione:</strong> {libro.publishedDate}
                      </p>
                    )}
                    
                    {/* Categorie */}
                    {libro.categories && libro.categories.length > 0 && (
                      <p style={{ 
                        margin: '0 0 0.5rem 0',
                        fontSize: '0.85rem',
                        color: '#555'
                      }}>
                        <strong>Categorie:</strong> {Array.isArray(libro.categories) ? libro.categories.join(', ') : libro.categories}
                      </p>
                    )}
                    
                    {/* ISBN-10 */}
                    {libro.isbn_10 && (
                      <p style={{ 
                        margin: '0 0 0.5rem 0',
                        fontSize: '0.85rem',
                        color: '#555'
                      }}>
                        <strong>ISBN-10:</strong> {libro.isbn_10}
                      </p>
                    )}
                    
                    {/* Pagine */}
                    {libro.pageCount && (
                      <p style={{ 
                        margin: '0 0 0.5rem 0',
                        fontSize: '0.85rem',
                        color: '#555'
                      }}>
                        <strong>Pagine:</strong> {libro.pageCount}
                      </p>
                    )}

                    {/* Stato libro */}
                    {libro.stato_libro && (
                      <p style={{ 
                        margin: '0 0 0.5rem 0',
                        fontSize: '0.85rem',
                        color: '#555'
                      }}>
                        <strong>Stato:</strong> {libro.stato_libro}
                      </p>
                    )}

                    {/* Disponibilità */}
                    <p style={{ 
                      margin: '0 0 0.5rem 0',
                      fontSize: '0.85rem',
                      color: '#555'
                    }}>
                      <strong>Disponibilità:</strong> {libro.prenotazione !== false ? '✅ Disponibile' : '❌ Non disponibile'}
                    </p>

                    {/* Nome e Cognome di chi ha affittato */}
                    {libro.prenotazione === false && libro.affittato_da && (
                      <p style={{ 
                        margin: '0 0 0.5rem 0',
                        fontSize: '0.85rem',
                        color: '#555'
                      }}>
                        <strong>Affittato da:</strong> {libro.affittato_da}
                      </p>
                    )}

                    {/* Data concessione */}
                    {libro.prenotazione === false && libro.data_concessione && (
                      <p style={{ 
                        margin: '0 0 0.5rem 0',
                        fontSize: '0.85rem',
                        color: '#555'
                      }}>
                        <strong>Concesso il:</strong> {new Date(libro.data_concessione).toLocaleString('it-IT')}
                      </p>
                    )}

                    {/* Data restituzione */}
                    {libro.prenotazione === false && libro.data_restituzione && (
                      <p style={{ 
                        margin: '0',
                        fontSize: '0.85rem',
                        color: '#555'
                      }}>
                        <strong>Restituzione prevista:</strong> {new Date(libro.data_restituzione).toLocaleString('it-IT')}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}

export default Biblioteca

