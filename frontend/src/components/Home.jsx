import PawMark from '../components/PawMark'

export default function Home({ navigate, lightCloud,SleepingCat, darkCloud}) {
      return (
    <main className="home-page">
      <header className="site-header">
        <button className="wordmark" type="button" onClick={() => navigate('home')}>
          <PawMark /><span>cat<b>matchmaker</b></span>
        </button>
        <nav className="site-nav" aria-label="Main navigation">
          <a href="#how-it-works">How it works</a>
          <a href="#our-promise">Our promise</a>
        </nav>
        <div className="header-actions">
          <button className="sign-in-button" type="button" onClick={() => navigate('login')}>Sign in</button>
        </div>
      </header>
      <section className="hero-section">
        <div className="hero-copy">
          <h1>A softer way to find your <em>best friend.</em></h1>
          <div className="hero-actions">
            <button className="primary-button" onClick={() => navigate('signup')}>Find your match <span aria-hidden="true">→</span></button>
            <button className="text-button" onClick={() => navigate('login')}>I’m a foster parent</button>
          </div>
        </div>
        <div className="home-hero-art">
        <img className="hero-cloud hero-cloud-dark" src={darkCloud} alt="" />
        <img className="hero-cloud hero-cloud-light" src={lightCloud} alt="" />
        <SleepingCat />
      </div>
      </section>
      <section className="journey-section" id="how-it-works">
        <div className="section-heading"><span className="eyebrow">A little less guesswork</span><h2>A little closer to your purrfect match.</h2></div>
        <div className="journey-grid">
          <article className="journey-step"><span className="step-icon step-icon-pink">♡</span><h3>Answer a short questionnaire.</h3><p>Help us understand your preferences and lifestyle to find the perfect match.</p></article>
          <article className="journey-step"><span className="step-icon step-icon-lilac">✿</span><h3>Get matched</h3><p>Find your purrfect matches based on information provided by foster parents</p></article>
          <article className="journey-step"><span className="step-icon step-icon-yellow">☀</span><h3>Meet your new little bestie!</h3><p>Meet your potential new companion and consider adopting them!</p></article>
        </div>
      </section>
      <section className="promise-section" id="our-promise">
        <div className="promise-mark"><PawMark /></div>
        <div><span className="eyebrow">Made for the in-between moments</span><h2>Here for the whole journey.</h2><p>From first browse to the first night at home, we are beside you and your new companion every step of the way.</p></div>
        <button className="outline-button" onClick={() => navigate('signup')}>Get started</button>
      </section>
      <footer className="site-footer"><button className="wordmark footer-wordmark" type="button" onClick={() => navigate('home')}><PawMark /><span>cat<b>matchmaker</b></span></button><span></span><button className="footer-login" type="button" onClick={() => navigate('login')}>Shelter & foster sign in</button></footer>
    </main>
  )
}