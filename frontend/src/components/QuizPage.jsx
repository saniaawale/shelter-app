import PawMark from '../components/PawMark'


export default function QuizPage({ onHome, questions, answers, reviewing, setReviewing, error, update, review, }) {
    return (
    <main className="quiz-page">
      <header className="auth-topbar">
        <button className="wordmark" type="button" onClick={onHome}><PawMark /><span>cat<b>matchmaker</b></span></button>
      </header>
      <section className="quiz-content" aria-labelledby="quiz-heading">
        <button className="back-link" type="button" onClick={onHome}>← Back to home</button>
        <h1 id="quiz-heading">{reviewing ? 'Your adoption preferences.' : 'Adoption Inquiry Form'}</h1>
        <p>{reviewing ? 'Check your answers below. You can go back to make changes.' : 'Tell us about your household and the companion you’re looking for.'}</p>
        {reviewing ? <>
          <dl className="quiz-review">
            {questions.map((question, index) => <div key={question.id}>
              <dt>Q{index}. {question.text}</dt>
              <dd>{Array.isArray(answers[question.id]) ? answers[question.id].join(', ') || 'None selected' : answers[question.id]}</dd>
            </div>)}
          </dl>
          <p className="form-notice" role="status">Your answers are ready to review. They haven’t been saved or sent to the shelter. Saving and cat matching are not available yet. Leaving this page clears your answers.</p>
          <button className="primary-button" type="button" onClick={() => setReviewing(false)}>Edit answers</button>
        </> : <form onSubmit={review}>
          {questions.map((question, index) => <fieldset className="quiz-question" key={question.id}>
            <legend>Q{index}. {question.text}</legend>
            {question.help && <p id={`${question.id}-help`}>{question.help}</p>}
            {question.multiple && <p>{question.id === 'household' ? 'Select all that apply. Leave blank if none apply.' : 'Select all that apply.'}</p>}
            {question.options ? <div className="quiz-options">
              {question.options.map((option, optionIndex) => <label className="quiz-option" key={option}>
                <input id={`${question.id}-${optionIndex}`} type={question.multiple ? 'checkbox' : 'radio'} name={question.id} value={option}
                  checked={question.multiple ? answers[question.id].includes(option) : answers[question.id] === option}
                  required={!question.multiple} onChange={() => update(question, option)} />
                <span>{option}</span>
              </label>)}
            </div> : <input className="quiz-text" aria-label={question.text} aria-describedby={question.help ? `${question.id}-help` : undefined}
              name={question.id} required maxLength={500} placeholder={question.placeholder} value={answers[question.id] || ''}
              onChange={event => update(question, event.target.value)} onBlur={event => update(question, event.target.value.trim())} />}
          </fieldset>)}
          {error && <p role="alert" className="form-notice">{error}</p>}
          <button className="primary-button" type="submit">Review my answers <span aria-hidden="true">→</span></button>
        </form>}
      </section>
    </main>
  )
}