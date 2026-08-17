import { useEffect, useState } from 'react'
import { loadQuizAnswers } from '../lib/guestQuiz'
import { fetchMatches, hasQuizAnswers } from '../lib/matchingApi'


export default function Matches({ navigate, quizAnswers }) {

  const [savedAnswers] = useState(loadQuizAnswers)
  const answers = quizAnswers ?? savedAnswers
  const [results, setResults] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [attempt, setAttempt] = useState(0)

  const complete = hasQuizAnswers(answers)

  useEffect(() => {
    if (!complete) return

    const controller = new AbortController()
    let active = true
    let timedOut = false
    const timeout = setTimeout(() => {
      timedOut = true
      controller.abort()
      if (active) {
        setError('Finding matches took too long. Please try again.')
        setLoading(false)
      }
    }, 15000)

    async function loadMatches() {
      setLoading(true)
      setError('')

    try {
      const data = await fetchMatches(answers,controller.signal)

      if (active && !timedOut){
        setResults(data)
      }
    } catch {
      if (active && !timedOut) {
        setError('Could not load cat matches. Please try again, or retake the quiz to check your answers.')
      }
    }finally {
      clearTimeout(timeout)
      if ( active ) {
        setLoading(false)
      }
    }
  }

  loadMatches()

  return() => {
    active = false
    clearTimeout(timeout)
    controller.abort()
  }
}, [answers, complete, attempt])

function renderCats(cats){
  return cats.map(cat => (
        <article key={cat.source_record_id}>
        <h3>{cat.name}</h3>
        <p>{cat.score} points</p>

        <ul>
          {cat.reasons.map((reason, index) => (
            <li key={index}>{reason}</li>
          ))}
        </ul>

        {cat.considerations.length > 0 && (
          <>
            <h4>Things to confirm</h4>
            <ul>
              {cat.considerations.map((item, index) => (
                <li key={index}>{item}</li>
              ))}
            </ul>
          </>
        )}
      </article>
  ))
}


  return (
    <main className="quiz-page">
      <section className="quiz-content" aria-labelledby="matches-heading">
        <button
          className="back-link"
          type="button"
          onClick={() => navigate('home')}
        >
          ← Back to home
        </button>

        <h1 id="matches-heading">Your cat matches</h1>
        <p>
          These are preference-based suggestions, not adoption approvals.
        </p>

        {!complete && (
          <p role="status">Complete the quiz to see your matches.</p>
        )}

        {loading && <p role="status">Finding your cat matches…</p>}

        {error && (
          <div role="alert">
            <p>{error}</p>
            <button
              type="button"
              onClick={() => setAttempt(previous => previous + 1)}
            >
              Try again
            </button>
          </div>
        )}

        {!loading && !error && results && (
          <>
            {results.matches.length > 0 && (
              <section aria-labelledby="preference-matches-heading">
                <h2 id="preference-matches-heading">Preference matches</h2>
                {renderCats(results.matches)}
              </section>
            )}

            {results.needs_confirmation.length > 0 && (
              <section aria-labelledby="confirmation-heading">
                <h2 id="confirmation-heading">Needs confirmation</h2>
                {renderCats(results.needs_confirmation)}
              </section>
            )}

            {results.matches.length === 0 &&
              results.needs_confirmation.length === 0 && (
                <p role="status">No eligible cats were returned for these answers.</p>
              )}
          </>
        )}

        <button
          className="primary-button"
          type="button"
          onClick={() => navigate('quiz')}
        >
          Retake quiz
        </button>
        <button className="outline-button" type="button" onClick={() => navigate('adopter-dashboard')}>
          My bookmarks
        </button>
      </section>
    </main>
  )
}
