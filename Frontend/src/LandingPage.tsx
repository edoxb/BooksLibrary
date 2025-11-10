import { useState, useEffect } from 'react'
import './LandingPage.css'
import { useKeycloak } from './KeycloakProvider'

type Section = 'chi-siamo' | 'storia' | 'contattaci'

const carouselImages = [
  'https://images.unsplash.com/photo-1605745341112-85968b19335b?w=1600&h=900&fit=crop&q=80',
  'https://images.unsplash.com/photo-1581091226825-a6a2a5aee158?w=1600&h=900&fit=crop&q=80',
  'https://images.unsplash.com/photo-1559827260-dc66d52bef19?w=1600&h=900&fit=crop&q=80',
]

export default function LandingPage() {
  const [activeSection, setActiveSection] = useState<Section | null>(null)
  const [currentSlide, setCurrentSlide] = useState(0)
  const { keycloak } = useKeycloak()

  useEffect(() => {
    if (activeSection === null) {
      // Imposta la prima slide come attiva
      setCurrentSlide(0)
      const interval = setInterval(() => {
        setCurrentSlide((prev) => {
          const next = (prev + 1) % carouselImages.length
          return next
        })
      }, 5000) // Cambia slide ogni 5 secondi
      return () => clearInterval(interval)
    } else {
      setCurrentSlide(0) // Reset quando si cambia sezione
    }
  }, [activeSection])

  const handleLogin = () => {
    keycloak.login()
  }

  return (
    <div className="landing-page">
      {/* Immagine di sfondo */}
      <div className="image-background">
        <div className="image-overlay"></div>
      </div>

      {/* Header orizzontale in alto */}
      <header className="top-header">
        <div className="header-content">
          <img 
            src="https://scontent-mxp2-1.cdninstagram.com/v/t51.2885-19/445412429_992429312271997_9003926946579995957_n.jpg?efg=eyJ2ZW5jb2RlX3RhZyI6InByb2ZpbGVfcGljLmRqYW5nby4zOTUuYzIifQ&_nc_ht=scontent-mxp2-1.cdninstagram.com&_nc_cat=101&_nc_oc=Q6cZ2QGU_47XhcG8bkmkH1UJS2oyMqCli_OopqwoiD8U_xMCvDvGbHsn63-9xFt4wWs3LiY&_nc_ohc=zQjcAAEMkIQ7kNvwEekORa&_nc_gid=QUXK5beAbETYLOtWQ1Sf0g&edm=APoiHPcBAAAA&ccb=7-5&oh=00_AfiW2u-lq26xfJVG9xeoSTFMadL-gKvrpx25pGX4fNwaxA&oe=6913ECC4&_nc_sid=22de04" 
            alt="Logo CRAL" 
            className="header-logo"
          />
          <h1>CRAAL - Compagnia Unica Lavoratori Portuali</h1>
        </div>
      </header>

      {/* Header verticale a destra */}
      <nav className="vertical-header">
        <ul>
          <li>
            <button
              onClick={() => setActiveSection('chi-siamo')}
              className={activeSection === 'chi-siamo' ? 'active' : ''}
            >
              Chi Siamo
            </button>
          </li>
          <li>
            <button
              onClick={() => setActiveSection('storia')}
              className={activeSection === 'storia' ? 'active' : ''}
            >
              Storia Biblioteca
            </button>
          </li>
          <li>
            <button
              onClick={() => setActiveSection('contattaci')}
              className={activeSection === 'contattaci' ? 'active' : ''}
            >
              Contattaci
            </button>
          </li>
          <li>
            <button
              onClick={handleLogin}
              className="biblioteca-button"
            >
              Biblioteca
            </button>
          </li>
        </ul>
      </nav>

      {/* Contenuto principale */}
      <main className="landing-content">
        {activeSection === null && (
          <>
            <div className="image-carousel">
              <div className="carousel-container">
                {carouselImages.map((image, index) => (
                  <div
                    key={index}
                    className={`carousel-slide ${index === currentSlide ? 'active' : ''}`}
                    style={{ display: index === currentSlide ? 'block' : 'none' }}
                  >
                    <img 
                      src={image} 
                      alt={`Slide ${index + 1}`}
                      loading="eager"
                      onError={(e) => {
                        console.error('Errore caricamento immagine:', image)
                        e.currentTarget.style.display = 'none'
                      }}
                    />
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

        {activeSection === 'chi-siamo' && (
          <div className="section chi-siamo-section">
            <h2>Chi Siamo</h2>
            <div className="video-container">
              <iframe
                src="https://www.youtube.com/embed/rIFoEigQswA?autoplay=1&mute=1&loop=1&playlist=rIFoEigQswA&controls=0&showinfo=0&rel=0&iv_load_policy=3&playsinline=1"
                title="Lavoratori Portuali"
                frameBorder="0"
                allow="autoplay; encrypted-media; picture-in-picture"
                allowFullScreen
                className="video-iframe"
              />
            </div>
            <p>
              BooksLibrary è una biblioteca digitale nata con l'obiettivo di valorizzare 
              e preservare la cultura e la storia dei lavoratori portuali.
            </p>
            <p>
              La nostra missione è creare un archivio accessibile che raccolga documenti, 
              testimonianze e pubblicazioni relative al mondo portuale, contribuendo così 
              alla conservazione della memoria collettiva di questo importante settore.
            </p>
            <p>
              Siamo un team appassionato di storia, cultura del lavoro e tecnologia, 
              impegnato a rendere la conoscenza accessibile a tutti.
            </p>
          </div>
        )}

        {activeSection === 'storia' && (
          <div className="section storia-section">
            <h2>Storia della Biblioteca</h2>
            <p>
              BooksLibrary nasce dalla volontà di preservare e condividere la ricca 
              storia dei lavoratori portuali italiani.
            </p>
            <p>
              Il progetto è iniziato con la raccolta di documenti storici, pubblicazioni 
              e testimonianze dirette di coloro che hanno lavorato nei porti italiani, 
              creando un archivio digitale che racconta l'evoluzione del settore portuale 
              nel corso degli anni.
            </p>
            <p>
              Oggi, BooksLibrary continua a crescere, aggiungendo costantemente nuovi 
              contenuti e rendendo disponibile a ricercatori, studenti e appassionati 
              un patrimonio culturale unico e prezioso.
            </p>
          </div>
        )}

        {activeSection === 'contattaci' && (
          <div className="section contattaci-section">
            <h2>Contattaci</h2>
            <div className="contact-info">
              <p>
                <strong>Email:</strong> info@bookslibrary.it
              </p>
              <p>
                <strong>Telefono:</strong> +39 010 123 4567
              </p>
              <p>
                <strong>Indirizzo:</strong><br />
                Via del Porto, 123<br />
                16100 Genova, Italia
              </p>
            </div>
            <form className="contact-form">
              <div className="form-group">
                <label htmlFor="nome">Nome</label>
                <input type="text" id="nome" name="nome" required />
              </div>
              <div className="form-group">
                <label htmlFor="email">Email</label>
                <input type="email" id="email" name="email" required />
              </div>
              <div className="form-group">
                <label htmlFor="messaggio">Messaggio</label>
                <textarea id="messaggio" name="messaggio" rows={5} required></textarea>
              </div>
              <button type="submit" className="submit-btn">Invia Messaggio</button>
            </form>
          </div>
        )}
      </main>
    </div>
  )
}

