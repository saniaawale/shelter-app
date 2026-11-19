import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import AdopterQuiz from '../pages/AdopterQuiz'
import { AuthContext } from '../context/authcontext.js'
import { loadQuizAnswers, saveQuizAnswers } from '../lib/guestQuiz'
import { supabase } from '../lib/supabase'

vi.mock('../lib/supabase', () => ({ supabase: { from: vi.fn() } }))
const answers = {
  readiness: 'Ready now', environment: 'Quiet household', household: ['Cat(s)'],
  experience: 'Somewhat experienced', temperaments: ['Lap cat'],
  age: 'Any age is a good age!', care: 'Very open', count: '1',
}
beforeEach(() => {
  vi.clearAllMocks()
  sessionStorage.clear()
  vi.spyOn(window, 'scrollTo').mockImplementation(() => {})
})
afterEach(() => { cleanup(); vi.restoreAllMocks() })

function renderQuiz() {
  const onViewMatches = vi.fn()
  const view = render(<AuthContext.Provider value={{ user: null, role: null, loading: false }}>
    <AdopterQuiz onHome={vi.fn()} onViewMatches={onViewMatches} />
  </AuthContext.Provider>)
  return { ...view, onViewMatches }
}
function fillQuiz() {
  fireEvent.change(screen.getByLabelText('When would you be ready to adopt?'), { target: { value: answers.readiness } })
  fireEvent.change(screen.getByLabelText('What kind of environment is your household like?'), { target: { value: answers.environment } })
  for (const value of ['Cat(s)', answers.experience, 'Lap cat', answers.age, answers.care, '1']) {
    fireEvent.click(screen.getByLabelText(value, { exact: true }))
  }
}
function review() { fireEvent.click(screen.getByRole('button', { name: /Review my answers/ })) }

describe('guest adopter quiz', () => {
  // Checks guests can review answers and request matches without account-based database calls.
  it('lets a guest complete the quiz without login', () => {
    const { onViewMatches } = renderQuiz()
    fillQuiz(); review()
    expect(screen.getByRole('heading', { name: 'Your adoption preferences.' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'View matches' }))
    expect(onViewMatches).toHaveBeenCalledOnce()
    expect(supabase.from).not.toHaveBeenCalled()
  })
  // Checks missing temperament validation focuses the choice and review/edit retains entered answers.
  it('requires a temperament and keeps answers when editing review', () => {
    renderQuiz(); fillQuiz()
    fireEvent.click(screen.getByLabelText('Lap cat', { exact: true }))
    review()
    expect(screen.getByRole('alert')).toHaveTextContent('Select at least one temperament')
    expect(screen.getByLabelText('Lap cat', { exact: true })).toHaveFocus()
    fireEvent.click(screen.getByLabelText('Lap cat', { exact: true }))
    review()
    fireEvent.click(screen.getByRole('button', { name: 'Edit answers' }))
    expect(screen.getByLabelText('When would you be ready to adopt?')).toHaveValue(answers.readiness)
    expect(screen.getByLabelText('Lap cat', { exact: true })).toBeChecked()
  })
  // Checks saved text, radio answers and checkbox arrays populate the form when it opens.
  it('restores session answers on opening the quiz', () => {
    saveQuizAnswers(answers); renderQuiz()
    expect(screen.getByLabelText('When would you be ready to adopt?')).toHaveValue(answers.readiness)
    expect(screen.getByLabelText('What kind of environment is your household like?')).toHaveValue(answers.environment)
    for (const value of ['Cat(s)', answers.experience, 'Lap cat', answers.age, answers.care, '1']) {
      expect(screen.getByLabelText(value, { exact: true })).toBeChecked()
    }
    expect(screen.getByLabelText('Dog(s)', { exact: true })).not.toBeChecked()
  })
  // Checks changes update session storage and remain after the quiz is unmounted and reopened.
  it('keeps edited answers after leaving and reopening the quiz', () => {
    saveQuizAnswers(answers)
    const { unmount } = renderQuiz()
    fireEvent.change(screen.getByLabelText('When would you be ready to adopt?'), { target: { value: 'Next month' } })
    expect(loadQuizAnswers()).toEqual({ ...answers, readiness: 'Next month' })
    unmount(); renderQuiz()
    expect(screen.getByLabelText('When would you be ready to adopt?')).toHaveValue('Next month')
    expect(screen.getByLabelText('Cat(s)', { exact: true })).toBeChecked()
  })
  // Checks blocked storage does not prevent filling, reviewing, or editing answers held in memory.
  it('remains usable when storage is blocked', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('Blocked') })
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('Blocked') })
    renderQuiz(); fillQuiz(); review()
    expect(screen.getByRole('heading', { name: 'Your adoption preferences.' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Edit answers' }))
    expect(screen.getByLabelText('When would you be ready to adopt?')).toHaveValue(answers.readiness)
    expect(screen.getByLabelText('Lap cat', { exact: true })).toBeChecked()
  })
})
