import './LandingPage.css'
import { useKeycloak } from './KeycloakProvider'

export default function LandingPage() {
  const { keycloak } = useKeycloak()

  const handleLogin = () => {
    keycloak.login()
  }

  const scrollToSection = (sectionId: string) => {
    const element = document.getElementById(sectionId)
    if (element) {
      const headerHeight = 100 // Altezza approssimativa dell'header
      const elementPosition = element.getBoundingClientRect().top + window.pageYOffset
      const offsetPosition = elementPosition - headerHeight

      window.scrollTo({
        top: offsetPosition,
        behavior: 'smooth'
      })
    }
  }

  const scrollToTop = () => {
    window.scrollTo({
      top: 0,
      behavior: 'smooth'
    })
  }

  return (
    <div className="landing-page">
      {/* Header orizzontale in alto */}
      <header className="top-header">
        <div className="header-content">
          <div className="header-left">
            <img 
              src="https://www.cittaadimpattopositivo.it/wp-content/uploads/2025/06/4828_P0021381-1.jpg" 
              alt="Logo CRAL" 
              className="header-logo"
            />
            <h1>CRAL - Compagnia Unica Lavoratori Portuali</h1>
          </div>
          <nav className="header-nav">
            <a
              href="#"
              onClick={(e) => {
                e.preventDefault()
                scrollToTop()
              }}
              className="nav-link biblioteca-link"
            >
              Biblioteca
            </a>
            <a
              href="#chi-siamo"
              onClick={(e) => {
                e.preventDefault()
                scrollToSection('chi-siamo')
              }}
              className="nav-link"
            >
              Chi Siamo
            </a>
            <a
              href="#storia"
              onClick={(e) => {
                e.preventDefault()
                scrollToSection('storia')
              }}
              className="nav-link"
            >
              Storia
            </a>
            <a
              href="#contattaci"
              onClick={(e) => {
                e.preventDefault()
                scrollToSection('contattaci')
              }}
              className="nav-link"
            >
              Contattaci
            </a>
          </nav>
        </div>
      </header>

      {/* Hero Section - Foto principale di presentazione */}
      <section className="hero-section">
        <div className="hero-content">
          <h2 className="hero-title">Benvenuti nella Biblioteca Digitale</h2>
          <p className="hero-subtitle">Un archivio dedicato alla storia e alla cultura dei lavoratori portuali</p>
          <button 
            onClick={handleLogin}
            className="hero-login-button"
          >
            Accedi alla Biblioteca
          </button>
        </div>
      </section>

      {/* Contenuto principale */}
      <main className="landing-content">
        <section id="chi-siamo" className="section chi-siamo-section">
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
        </section>

        <section id="storia" className="section storia-section">
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
        </section>

        <section id="contattaci" className="section contattaci-section">
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
        </section>
      </main>
    </div>
  )
}

