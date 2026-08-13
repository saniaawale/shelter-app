import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import AdopterQuiz from '../pages/AdopterQuiz'
import { AuthContext } from '../context/authcontext.js'
import { loadQuizAnswers, saveQuizAnswers } from '../lib/guestQuiz'
import { supabase } from '../lib/supabase'

vi.mock('../lib/supabase', () => ({ supabase: { from: vi.fn() } }))
const answers = {
  readiness: 'Ready now', environment: 'Quiet', household: ['Cat(s)'],
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
  fireEvent.click(screen.getByRole('radio', { name: answers.readiness, exact: true }))
  fireEvent.click(screen.getByRole('radio', { name: answers.environment, exact: true }))
  for (const value of ['Cat(s)', answers.experience, 'Lap cat', answers.age, answers.care, '1']) {
    fireEvent.click(screen.getByLabelText(value, { exact: true }))
  }
}
function review() { fireEvent.click(screen.getByRole('button', { name: /Review my answers/ })) }

describe('guest adopter quiz', () => {
  // Checks every approved readiness/environment choice is a required single-select radio.
  it.each([
    ['Ready now', 'Within 1 month', 'Within 3 months', 'Just exploring'],
    ['Quiet', 'Moderately active', 'Very active'],
  ])('offers approved choices starting with %s', (...options) => {
    // Open a fresh guest form without saved answers.
    renderQuiz()
    for (const option of options) {
      // Choosing the next option must replace the previous selection in this group.
      const radio = screen.getByRole('radio', { name: option, exact: true })
      fireEvent.click(radio)
      expect(radio).toBeRequired()
      expect(radio).toBeChecked()
      for (const other of options.filter(value => value !== option)) {
        expect(screen.getByRole('radio', { name: other, exact: true })).not.toBeChecked()
      }
    }
    // These questions must no longer expose typed-answer fields.
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
  })
  // Checks guests can review answers and request matches without account-based database calls.
  it('lets a guest complete the quiz without login', () => {
    // Fill the public form and open review using the approved radio choices.
    const { onViewMatches } = renderQuiz()
    fillQuiz(); review()
    expect(screen.getByRole('heading', { name: 'Your adoption preferences.' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'View matches' }))
    // Requesting matches must work without an account-based database write.
    expect(onViewMatches).toHaveBeenCalledOnce()
    expect(supabase.from).not.toHaveBeenCalled()
  })
  // Checks missing temperament validation focuses the choice and review/edit retains entered answers.
  it('requires a temperament and keeps answers when editing review', () => {
    // Remove the required temperament from an otherwise completed guest form.
    renderQuiz(); fillQuiz()
    fireEvent.click(screen.getByLabelText('Lap cat', { exact: true }))
    review()
    expect(screen.getByRole('alert')).toHaveTextContent('Select at least one temperament')
    expect(screen.getByLabelText('Lap cat', { exact: true })).toHaveFocus()
    // Correct the missing choice, then check radio/checkbox selections survive editing.
    fireEvent.click(screen.getByLabelText('Lap cat', { exact: true }))
    review()
    fireEvent.click(screen.getByRole('button', { name: 'Edit answers' }))
    expect(screen.getByRole('radio', { name: answers.readiness, exact: true })).toBeChecked()
    expect(screen.getByLabelText('Lap cat', { exact: true })).toBeChecked()
  })
  // Checks saved radio answers and checkbox arrays populate the form when it opens.
  it('restores session answers on opening the quiz', () => {
    // Seed browser storage, then verify saved selections populate the controls.
    saveQuizAnswers(answers); renderQuiz()
    expect(screen.getByRole('radio', { name: answers.readiness, exact: true })).toBeChecked()
    expect(screen.getByRole('radio', { name: answers.environment, exact: true })).toBeChecked()
    for (const value of ['Cat(s)', answers.experience, 'Lap cat', answers.age, answers.care, '1']) {
      expect(screen.getByLabelText(value, { exact: true })).toBeChecked()
    }
    expect(screen.getByLabelText('Dog(s)', { exact: true })).not.toBeChecked()
  })
  // Checks changes update session storage and remain after the quiz is unmounted and reopened.
  it('keeps edited answers after leaving and reopening the quiz', () => {
    // Start with saved choices and change readiness through its radio control.
    saveQuizAnswers(answers)
    const { unmount } = renderQuiz()
    fireEvent.click(screen.getByRole('radio', { name: 'Within 1 month', exact: true }))
    expect(loadQuizAnswers()).toEqual({ ...answers, readiness: 'Within 1 month' })
    // Reopening the component must retain the newly selected choice.
    unmount(); renderQuiz()
    expect(screen.getByRole('radio', { name: 'Within 1 month', exact: true })).toBeChecked()
    expect(screen.getByLabelText('Cat(s)', { exact: true })).toBeChecked()
  })
  // Checks blocked storage does not prevent filling, reviewing, or editing answers held in memory.
  it('remains usable when storage is blocked', () => {
    // Simulate unavailable browser storage while keeping answers in React memory.
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('Blocked') })
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('Blocked') })
    renderQuiz(); fillQuiz(); review()
    // Review and editing must retain selected radio and checkbox values.
    expect(screen.getByRole('heading', { name: 'Your adoption preferences.' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Edit answers' }))
    expect(screen.getByRole('radio', { name: answers.readiness, exact: true })).toBeChecked()
    expect(screen.getByLabelText('Lap cat', { exact: true })).toBeChecked()
  })
  // Legacy typed answers must be reselected rather than silently treated as approved choices.
  it('asks for a current option when saved answers contain old free text', () => {
    // Restore a formerly valid typed readiness answer alongside the other saved fields.
    saveQuizAnswers({ ...answers, readiness: 'Next month' })
    renderQuiz()
    // Submit directly to exercise application validation independently of browser validation.
    fireEvent.submit(screen.getByRole('button', { name: /Review my answers/ }).closest('form'))
    expect(screen.getByRole('alert')).toHaveTextContent('Please select an option')
    expect(screen.getByRole('radio', { name: 'Ready now', exact: true })).toHaveFocus()
    // The visitor can explicitly select a replacement and continue reviewing.
    fireEvent.click(screen.getByRole('radio', { name: 'Within 1 month', exact: true }))
    review()
    expect(screen.getByRole('heading', { name: 'Your adoption preferences.' })).toBeInTheDocument()
  })
})
