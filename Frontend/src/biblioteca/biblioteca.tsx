import { useState, useEffect } from 'react'
import { useKeycloak } from '../KeycloakProvider'

interface Libro {
  id: string
  titolo: string
  data_pubblicazione: string
  autore: string
  genere: string
  sottogenere?: string
  recensione?: string
  commento?: string
  immagine?: string
}

interface LibroFormData {
  titolo: string
  data_pubblicazione: string
  autore: string
  genere: string
  sottogenere: string
  recensione: string
  commento: string
  immagine: string
}

function Biblioteca() {
  const { keycloak } = useKeycloak()
  const [libri, setLibri] = useState<Libro[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [formData, setFormData] = useState<LibroFormData>({
    titolo: '',
    data_pubblicazione: '',
    autore: '',
    genere: '',
    sottogenere: '',
    recensione: '',
    commento: '',
    immagine: ''
  })
  const [submitting, setSubmitting] = useState(false)
  const [isAdmin, setIsAdmin] = useState(false)

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

  useEffect(() => {
    const fetchLibri = async () => {
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
        
        // Usa il proxy configurato in vite.config.ts
        const response = await fetch('/api/libri', {
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
              const retryResponse = await fetch('/api/libri', {
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
        console.error('Errore nel recupero dei libri:', err)
      } finally {
        setLoading(false)
      }
    }

    fetchLibri()
  }, [keycloak])

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: value
    }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    setError(null)

    try {
      // Prepara i dati per la chiamata POST
      const libroData: any = {
        titolo: formData.titolo,
        data_pubblicazione: formData.data_pubblicazione,
        autore: formData.autore,
        genere: formData.genere
      }

      // Aggiungi campi opzionali solo se non vuoti
      if (formData.sottogenere.trim()) {
        libroData.sottogenere = formData.sottogenere
      }
      if (formData.recensione.trim()) {
        libroData.recensione = formData.recensione
      }
      if (formData.commento.trim()) {
        libroData.commento = formData.commento
      }
      if (formData.immagine.trim()) {
        libroData.immagine = formData.immagine
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

      const nuovoLibro = await response.json()
      
      // Aggiungi il nuovo libro alla lista
      setLibri(prev => [...prev, nuovoLibro])
      
      // Reset del form
      setFormData({
        titolo: '',
        data_pubblicazione: '',
        autore: '',
        genere: '',
        sottogenere: '',
        recensione: '',
        commento: '',
        immagine: ''
      })
      setShowForm(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Errore durante l\'aggiunta del libro')
      console.error('Errore nell\'aggiunta del libro:', err)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <>
      {isAdmin && (
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
      )}

      {showForm && (
        <div className="form-container" style={{ 
          marginBottom: '2rem', 
          padding: '1.5rem', 
          border: '1px solid #ddd', 
          borderRadius: '8px',
          backgroundColor: '#f9f9f9'
        }}>
          <h2>Aggiungi Nuovo Libro</h2>
          <form onSubmit={handleSubmit}>
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

            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>
                Data Pubblicazione *
              </label>
              <input
                type="date"
                name="data_pubblicazione"
                value={formData.data_pubblicazione}
                onChange={handleInputChange}
                required
                style={{ width: '100%', padding: '0.5rem', fontSize: '1rem', borderRadius: '4px', border: '1px solid #ddd' }}
              />
            </div>

            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>
                Autore *
              </label>
              <input
                type="text"
                name="autore"
                value={formData.autore}
                onChange={handleInputChange}
                required
                style={{ width: '100%', padding: '0.5rem', fontSize: '1rem', borderRadius: '4px', border: '1px solid #ddd' }}
              />
            </div>

            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>
                Genere *
              </label>
              <input
                type="text"
                name="genere"
                value={formData.genere}
                onChange={handleInputChange}
                required
                style={{ width: '100%', padding: '0.5rem', fontSize: '1rem', borderRadius: '4px', border: '1px solid #ddd' }}
              />
            </div>

            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>
                Sottogenere
              </label>
              <input
                type="text"
                name="sottogenere"
                value={formData.sottogenere}
                onChange={handleInputChange}
                style={{ width: '100%', padding: '0.5rem', fontSize: '1rem', borderRadius: '4px', border: '1px solid #ddd' }}
              />
            </div>

            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>
                URL Immagine
              </label>
              <input
                type="url"
                name="immagine"
                value={formData.immagine}
                onChange={handleInputChange}
                placeholder="https://example.com/copertina.jpg"
                style={{ width: '100%', padding: '0.5rem', fontSize: '1rem', borderRadius: '4px', border: '1px solid #ddd' }}
              />
            </div>

            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>
                Recensione
              </label>
              <textarea
                name="recensione"
                value={formData.recensione}
                onChange={handleInputChange}
                rows={4}
                style={{ width: '100%', padding: '0.5rem', fontSize: '1rem', borderRadius: '4px', border: '1px solid #ddd', fontFamily: 'inherit' }}
              />
            </div>

            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>
                Commento
              </label>
              <textarea
                name="commento"
                value={formData.commento}
                onChange={handleInputChange}
                rows={4}
                style={{ width: '100%', padding: '0.5rem', fontSize: '1rem', borderRadius: '4px', border: '1px solid #ddd', fontFamily: 'inherit' }}
              />
            </div>

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
          {libri.length === 0 ? (
            <p>Nessun libro trovato nel database.</p>
          ) : (
            <div className="libri-container">
              <h2>Lista Libri ({libri.length})</h2>
              <div className="libri-grid">
                {libri.map((libro) => (
                  <div key={libro.id} className="libro-card">
                    {libro.immagine && (
                      <div className="libro-immagine">
                        <img 
                          src={libro.immagine}
                          alt={`Copertina di ${libro.titolo}`}
                          style={{ maxWidth: '100%', height: 'auto', borderRadius: '8px', marginBottom: '1rem' }}
                          onError={(e) => {
                            (e.target as HTMLImageElement).style.display = 'none';
                          }}
                        />
                      </div>
                    )}
                    <h3>{libro.titolo}</h3>
                    <p className="autore">di {libro.autore}</p>
                    <p className="genere">
                      <strong>Genere:</strong> {libro.genere}
                      {libro.sottogenere && ` - ${libro.sottogenere}`}
                    </p>
                    <p className="data">
                      <strong>Pubblicato:</strong> {new Date(libro.data_pubblicazione).toLocaleDateString('it-IT')}
                    </p>
                    {libro.recensione && (
                      <p className="recensione">
                        <strong>Recensione:</strong> {libro.recensione}
                      </p>
                    )}
                    {libro.commento && (
                      <p className="commento">
                        <strong>Commento:</strong> {libro.commento}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </>
  )
}

export default Biblioteca

