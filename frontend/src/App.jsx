import { useEffect, useState } from 'react'
import './App.css'
import AdopterQuiz from './pages/AdopterQuiz'
import sleepingCat from './assets/sleeping_cat.png'
import darkCloud from './assets/dark_cloud.png'
import lightCloud from './assets/light_cloud.png'
import Home from './components/Home'
import LoginSignup from './components/LoginSignup'

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

  if (page === 'foster-dashboard') {
    return (
      <main>
        <h1>Foster dashboard</h1>
        <p>Your foster tools will appear here.</p>
      </main>
    )
  }

  if (page === 'shelter-dashboard') {
    return (
      <main>
        <h1>Shelter dashboard</h1>
        <p>Your shelter tools will appear here.</p>
      </main>
    )
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
