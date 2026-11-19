export default function CatDetails({ navigate }) {
  return (
    <main className="quiz-page">
      <section className="quiz-content" aria-labelledby="cat-heading">
        <button className="back-link" type="button" onClick={() => navigate('matches')}>← Back to matches</button>
        <h1 id="cat-heading">Cat details</h1>
        <p role="status">Cat profiles are not available yet.</p>
      </section>
    </main>
  )
}
