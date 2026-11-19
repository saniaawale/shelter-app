import { useEffect, useState } from 'react'
import { loadQuizAnswers } from '../lib/guestQuiz'
import { fetchMatches, hasQuizAnswers } from '../lib/matchingApi'

function ResultGroup({ title, cats }) {
  if (!cats.length) return null
  return (
    <section className="match-group" aria-label={title}>
      <h2>{title}</h2>
      <ol className="match-list">
        {cats.map(cat => <li key={cat.source_record_id} className="match-card">
          <h3>{cat.name}</h3>
          <p>Preference score: <strong>{cat.score} points</strong></p>
          {cat.reasons.length > 0 ? <ul aria-label={`Matching reasons for ${cat.name}`}>
            {cat.reasons.map((reason, index) => <li key={index}>{reason}</li>)}
          </ul> : <p>No preferred age or companionship style matched.</p>}
          {cat.considerations.length > 0 && <div className="match-considerations">
            <h4>Needs confirmation</h4>
            <ul>{cat.considerations.map((item, index) => <li key={index}>{item}</li>)}</ul>
          </div>}
        </li>)}
      </ol>
    </section>
  )
}

export default function Matches({ navigate, quizAnswers }) {
  const [answers] = useState(() => quizAnswers || loadQuizAnswers())
  const complete = hasQuizAnswers(answers)
  const [request, setRequest] = useState(0)
  const [state, setState] = useState({ status: complete ? 'loading' : 'missing' })

  useEffect(() => {
    if (!complete) return
    const controller = new AbortController()
    let active = true
    const timeout = setTimeout(() => controller.abort(), 15000)
    fetchMatches(answers, controller.signal)
      .then(data => { if (active) setState({ status: 'success', data }) })
      .catch(error => {
        if (active) setState({ status: 'error', message: error.name === 'AbortError'
          ? 'Cat matching took too long. Please try again.'
          : error instanceof TypeError ? 'Could not reach cat matching. Please try again.' : 'Could not load cat matches. Please try again or retake the quiz.' })
      })
      .finally(() => clearTimeout(timeout))
    return () => {
      active = false
      clearTimeout(timeout)
      controller.abort()
    }
  }, [answers, complete, request])

  function retry() {
    setState({ status: 'loading' })
    setRequest(previous => previous + 1)
  }

  return (
    <main className="quiz-page">
      <section className="quiz-content" aria-labelledby="matches-heading">
        <button className="back-link" type="button" onClick={() => navigate('home')}>← Back to home</button>
        <h1 id="matches-heading">Your cat matches</h1>
        <p>Suggestions based on your preferences, not adoption approvals. Scores are preference points, not probabilities.</p>
        {state.status === 'missing' && <p role="status">Complete the quiz to see your cat matches.</p>}
        {state.status === 'loading' && <p role="status">Finding your cat matches…</p>}
        {state.status === 'error' && <div>
          <p role="alert">{state.message}</p>
          <button className="outline-button" type="button" onClick={retry}>Try again</button>
        </div>}
        {state.status === 'success' && <>
          {!state.data.matches.length && !state.data.needs_confirmation.length
            && <p role="status">No eligible cats were returned for your preferences. Availability may need confirmation. You can retake the quiz or check back later.</p>}
          <ResultGroup title="Preference matches" cats={state.data.matches} />
          <ResultGroup title="Needs confirmation" cats={state.data.needs_confirmation} />
        </>}
        <div className="match-actions">
          <button className="primary-button" type="button" onClick={() => navigate('quiz')}>Retake quiz</button>
          <button className="outline-button" type="button" onClick={() => navigate('adopter-dashboard')}>My bookmarks</button>
        </div>
      </section>
    </main>
  )
}
