import { useState } from 'react'
import QuizPage from '../components/QuizPage'


const questions = [
  { id: 'readiness', text: 'When would you be ready to adopt?', placeholder: 'Immediately!', help: "We ask that all potential adopters inquire once they're ready to adopt; as we cannot guarantee availability for any given cat" },
  { id: 'environment', text: 'What kind of environment is your household like?', placeholder: 'Moderately active' },
  { id: 'household', text: 'Do you currently have any of the following in your household?', multiple: true, options: ['Dog(s)', 'Cat(s)', 'Children'] },
  { id: 'experience', text: "What's your experience level with cats?", options: ['Very experienced', 'Somewhat experienced', 'No experience'] },
  { id: 'temperaments', text: 'Which of the following temperaments would you be open to?', multiple: true, options: ['Lap cat', 'Likes to be near but not on me', 'Allows pets but is independent', 'A little sassy and fesity', 'Spirit cat'] },
  { id: 'age', text: 'What age are you looking for?', options: ['Kitten (Under 1 year)', 'Young adult (2-4 years)', 'Older adult (5-8 years)', 'Senior (9+ years)', 'Any age is a good age!'] },
  { id: 'care', text: 'Are you open to a special needs cat (e.g.,...)?', options: ['Very open', 'Somewhat open - it depends on the needs', 'Not open at all'] },
  { id: 'count', text: 'How many cats are you looking to adopt?', options: ['1', '2+'] },
]

export default function AdopterQuiz({ onHome }) {
  const [answers, setAnswers] = useState({ household: [], temperaments: [] })
  const [reviewing, setReviewing] = useState(false)
  const [error, setError] = useState('')

  function update(question, value) {
    setError('')
    setAnswers(previous => ({ ...previous, [question.id]: question.multiple
      ? previous[question.id].includes(value)
        ? previous[question.id].filter(item => item !== value)
        : [...previous[question.id], value]
      : value }))
  }

  function review(event) {
    event.preventDefault()
    if (!answers.temperaments.length) {
      setError('Select at least one temperament you would be open to.')
      document.getElementById('temperaments-0')?.focus()
      return
    }
    setReviewing(true)
    window.scrollTo(0, 0)
  }


  return (
  <QuizPage
    onHome={onHome}
    questions={questions}
    answers={answers}
    reviewing={reviewing}
    setReviewing={setReviewing}
    error={error}
    update={update}
    review={review}
  />
)

  
}

