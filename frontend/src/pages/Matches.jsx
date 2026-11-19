//import { useState } from 'react'
//import { loadQuizAnswers } from '../lib/guestQuiz'


export default function Matches({ navigate }) {

  //const [answers] = useState(loadQuizAnswers)


  // Later, send answers to the matching endpoint.
  // Keep the current page content until that endpoint exists.

  return (
    <main className="quiz-page">
      <section className="quiz-content" aria-labelledby="matches-heading">
        <button className="back-link" type="button" onClick={() => navigate('home')}>← Back to home</button>
        <h1 id="matches-heading">Your cat matches</h1>
        <p role="status">Cat matching is not available yet. Once it is ready, your quiz results will appear here.</p>
        <button className="primary-button" type="button" onClick={() => navigate('quiz')}>Retake quiz</button>
        <button className="outline-button" type="button" onClick={() => navigate('adopter-dashboard')}>My bookmarks</button>
      </section>
    </main>
  )
}
