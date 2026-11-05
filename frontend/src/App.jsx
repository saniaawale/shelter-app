import { useEffect, useState } from 'react'
import './App.css'
import PawMark from './components/PawMark'
import AdopterQuiz from './pages/AdopterQuiz'
import sleepingCat from './assets/sleeping_cat.png'
import cloudCat from './assets/cloud_cat.png'
import darkCloud from './assets/dark_cloud.png'
import lightCloud from './assets/light_cloud.png'
import lightestCloud from './assets/lightest_cloud.png'
import { supabase } from './lib/supabase'
import Home from '../components/Home'


function SleepingCat() {
  return (
    <div className="hero-art">
      <img
        className="cat-png"
        src={sleepingCat}
        alt="A sleeping cat"
      />
    </div>
  )
}

function CloudCat() {
  return (
    <div className="hero-art">
      <img
        className="cat-png"
        src={cloudCat}
        alt="A cat on a cloud"
      />
    </div>
  )
}

function DarkCloud() {
  return (
    <div className="hero-art">
      <img
        className="cloud-png"
        src={darkCloud}
        alt="A dark cloud"
      />
    </div>
  )
}

function LightCloud() {
  return (
    <div className="hero-art">
      <img
        className="cloud-png"
        src={lightCloud}
        alt="A light cloud"
      />
    </div>
  )
}

function LightestCloud() {
  return (
    <div className="hero-art">
      <img
        className="cloud-png"
        src={lightestCloud}
        alt="A lightest cloud"
      />
    </div>
  )
}

function App() {
  const [page, setPage] = useState(() => window.location.pathname.replace('/', '') || 'home')
  const [notice, setNotice] = useState('')

  useEffect(() => {
    const onPopState = () => {
      setPage(window.location.pathname.replace('/', '') || 'home')
      setNotice('')
    }
    window.addEventListener('popstate', onPopState)
    return () => window.removeEventListener('popstate', onPopState)
  }, [])

  function navigate(nextPage) {
    const path = nextPage === 'home' ? '/' : `/${nextPage}`
    if (window.location.pathname !== path) window.history.pushState({}, '', path)
    setPage(nextPage)
    setNotice('')
    window.scrollTo(0, 0)
  }

async function submitForm(event) {
  event.preventDefault()
  setNotice('')

  const form = new FormData(event.currentTarget)

  if (page === 'signup') {
    if (form.get('password') !== form.get('confirm-password')) {
      setNotice('Passwords don’t match. Please try again.')
      return
    }

    try {
      const { data, error } = await supabase.auth.signUp({
        email: form.get('email'),
        password: form.get('password'),
        options: {
          data: { full_name: form.get('name') },
          emailRedirectTo: `${window.location.origin}/login`,
        },
      })

      if (error) {
        setNotice(error.message)
        return
      }

      if (data.session) {
        navigate('quiz')
      } else {
        setNotice('Check your email to confirm your account, then sign in.')
      }
    } catch {
      setNotice('Couldn’t connect. Please try again.')
    }
  } else {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: form.get('email'),
        password: form.get('password'),
      })

      if (error) {
        setNotice(error.message)
        return
      }

      if (data.session) {
        navigate('dashboard')
      }
    } catch {
      setNotice('Couldn’t connect. Please try again.')
    }
  }
}


  if (page === 'quiz') return <AdopterQuiz onHome={() => navigate('home')} />

  if (page === 'login' || page === 'signup') {
    const isSignup = page === 'signup'
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
              <h1 id="auth-heading">{isSignup ? 'Start your story together.' : 'Welcome back, friend.'}</h1>
              <p>{isSignup ? 'Create an account to save your favorites and keep your adoption journey in one place.' : 'Sign in to pick up where you left off :)'}</p>
            </div>
          </div>
          <div className="auth-card-wrap">
            <div className="auth-card">
              <span className="card-paw"><PawMark /></span>
              <h2>{isSignup ? 'Make an account' : 'Sign in'}</h2>
              <p className="form-subtitle">{}</p>
              <form onSubmit={submitForm} className="auth-form">
                {isSignup && <label>Full name<input name="name" autoComplete="name" placeholder="Your name" required /></label>}
                <label>Email address<input name="email" type="email" autoComplete="email" placeholder="you@example.com" required /></label>
                <label>Password<input name="password" type="password" autoComplete={isSignup ? 'new-password' : 'current-password'} placeholder="At least 8 characters" minLength="8" required /></label>
                {isSignup && <label>Confirm password<input name="confirm-password" type="password" autoComplete="new-password" placeholder="Type it again" minLength="8" required /></label>}
                {!isSignup && <button className="forgot-link" type="button" onClick={() => setNotice('Ask your shelter team for help resetting your password.')}>Forgot password?</button>}
                <button className="primary-button auth-submit" type="submit">{isSignup ? 'Create account' : 'Sign in'} <span aria-hidden="true">→</span></button>
              </form>
              {notice && <p className="form-notice" role="status">{notice}</p>}
              <p className="switch-auth">{isSignup ? 'Already have an account?' : 'New around here?'}{' '}
                <button type="button" onClick={() => navigate(isSignup ? 'login' : 'signup')}>{isSignup ? 'Sign in' : 'Create an account'}</button>
              </p>
            </div>
          </div>
        </section>
      </main>
    )
  }

  return (
  <Home
    navigate={navigate}
    lightCloud={lightCloud}
    darkCloud={darkCloud}
    SleepingCat={SleepingCat}
  />
)


}

export default App
