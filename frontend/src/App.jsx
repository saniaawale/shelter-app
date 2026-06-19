import { useContext, useEffect, useState } from 'react'
import './App.css'
import AdopterQuiz from './pages/AdopterQuiz'
import sleepingCat from './assets/sleeping_cat.png'
import darkCloud from './assets/dark_cloud.png'
import lightCloud from './assets/light_cloud.png'
import Home from './components/Home'
import LoginSignup from './components/LoginSignup'
import { AuthContext } from './context/authcontext.js'
import ShelterDashboard from './pages/ShelterDashboard.jsx'

const requiredRoles = {
  quiz: 'adopter',
  'foster-dashboard': 'foster',
  'shelter-dashboard': 'shelter',
}

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

function App() {
  const { user, role, loading, error } = useContext(AuthContext)
  const [page, setPage] = useState(
    () => window.location.pathname.replace('/', '') || 'home'
  )

  useEffect(() => {
    const onPopState = () => {
      setPage(window.location.pathname.replace('/', '') || 'home')
    }

    window.addEventListener('popstate', onPopState)
    return () => window.removeEventListener('popstate', onPopState)
  }, [])

  function navigate(nextPage) {
    const path = nextPage === 'home' ? '/' : `/${nextPage}`

    if (window.location.pathname !== path) {
      window.history.pushState({}, '', path)
    }

    setPage(nextPage)
    window.scrollTo(0, 0)
  }

  const requiredRole = requiredRoles[page]

  if (requiredRole) {
    if (loading) {
      return <main><p role="status">Checking your account…</p></main>
    }

    if (!user) {
      return <LoginSignup key="login" page="login" navigate={navigate} />
    }

    if (error || role !== requiredRole) {
      return (
        <main>
          <h1>Access unavailable</h1>
          <p role="alert">{error || 'Your account does not have access to this page.'}</p>
          <button type="button" onClick={() => navigate('home')}>Back to home</button>
        </main>
      )
    }
  }

  if (page === 'foster-dashboard') {
    return (
      <main>
        <h1>Foster dashboard</h1>
        <p>Your foster tools will appear here.</p>
      </main>
    )
  }

  if (page === 'shelter-dashboard') {
  return <ShelterDashboard />
  }

  if (page === 'quiz') {
    return <AdopterQuiz onHome={() => navigate('home')} />
  }

  if (page === 'login' || page === 'signup') {
    return <LoginSignup key={page} page={page} navigate={navigate} />
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
