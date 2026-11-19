export default function AdopterDashboard({ navigate }) {
  return (
    <main className="quiz-page">
      <section className="quiz-content" aria-labelledby="bookmarks-heading">
        <h1 id="bookmarks-heading">Bookmarked cats</h1>
        <p role="status">Bookmarking is not available yet. Your saved cats will appear here once it is ready.</p>
        <button className="primary-button" type="button" onClick={() => navigate('quiz')}>
          Retake quiz
        </button>
      </section>
    </main>
  )
}
