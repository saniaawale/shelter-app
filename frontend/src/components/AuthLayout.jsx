import PawMark from './PawMark'
import CloudCat from './CloudCat'

export default function AuthLayout({ navigate, heading, description, title, children }) {
  return (
    <main className="auth-page">
      <div className="auth-topbar">
        <button className="wordmark" type="button" onClick={() => navigate('home')}>
          <PawMark /><span>Cat <b>matchmaker</b></span>
        </button>
      </div>
      <section className="auth-layout" aria-labelledby="auth-heading">
        <div className="auth-copy">
          <button className="back-link" onClick={() => navigate('home')} type="button">← Back to home</button>
          <div className="auth-intro">
            <h1 id="auth-heading">{heading}</h1>
            <p>{description}</p>
          </div>
          <CloudCat />
        </div>
        <div className="auth-card-wrap">
          <div className="auth-card">
            <span className="card-paw"><PawMark /></span>
            <h2>{title}</h2>
            <p className="form-subtitle" />
            {children}
          </div>
        </div>
      </section>
    </main>
  )
}
