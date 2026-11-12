import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import AdopterQuiz from '../pages/AdopterQuiz'
import { AuthContext } from '../context/authcontext.js'
import { supabase } from '../lib/supabase'

vi.mock('../lib/supabase', () => ({ supabase: { from: vi.fn() } }))

// Proposed persistence contract, not an existing database table:
// adopter_quiz_answers(user_id unique references auth.users, answers jsonb).
// Loading uses select('answers').eq('user_id', user.id).maybeSingle().
// Saving uses upsert({ user_id: user.id, answers }, { onConflict: 'user_id' }).
// Keep these specifications red until quiz persistence is implemented.
const userId = '00000000-0000-4000-8000-000000000001'
const answers = {
  readiness: 'Ready now', environment: 'Quiet household', household: ['Cat(s)'],
  experience: 'Somewhat experienced', temperaments: ['Lap cat'],
  age: 'Any age is a good age!', care: 'Very open', count: '1',
}
const maybeSingle = vi.fn()
const eq = vi.fn(() => ({ maybeSingle }))
const select = vi.fn(() => ({ eq }))
const upsert = vi.fn()

beforeEach(() => {
  vi.clearAllMocks()
  maybeSingle.mockReset()
  upsert.mockReset()
  vi.spyOn(window, 'scrollTo').mockImplementation(() => {})
  supabase.from.mockReturnValue({ select, upsert })
  maybeSingle.mockResolvedValue({ data: null, error: null })
  upsert.mockResolvedValue({ data: null, error: null })
})
afterEach(() => { cleanup(); vi.restoreAllMocks() })

function renderQuiz(auth = {}) {
  return render(<AuthContext.Provider value={{
    user: { id: userId }, role: 'adopter', loading: false, ...auth,
  }}><AdopterQuiz onHome={vi.fn()} /></AuthContext.Provider>)
}
async function fillQuiz() {
  const readiness = await screen.findByRole('textbox', { name: 'When would you be ready to adopt?' })
  fireEvent.change(readiness, { target: { value: answers.readiness } })
  fireEvent.change(screen.getByRole('textbox', { name: 'What kind of environment is your household like?' }), {
    target: { value: answers.environment },
  })
  for (const value of ['Cat(s)', 'Somewhat experienced', 'Lap cat', 'Any age is a good age!', 'Very open', '1']) {
    fireEvent.click(screen.getByLabelText(value, { exact: true }))
  }
}
function review() { fireEvent.click(screen.getByRole('button', { name: /Review my answers/ })) }
function save() { fireEvent.click(screen.getByRole('button', { name: /Save preferences/i })) }

describe('adopter quiz existing behavior', () => {
  // Checks temperament validation, focus on the invalid choice, and that review/edit keeps answers without saving.
  it('requires a temperament and preserves entered answers when returning from review', async () => {
    renderQuiz()
    await fillQuiz()
    fireEvent.click(screen.getByLabelText('Lap cat', { exact: true }))
    review()
    expect(screen.getByRole('alert')).toHaveTextContent('Select at least one temperament')
    expect(screen.getByLabelText('Lap cat', { exact: true })).toHaveFocus()
    fireEvent.click(screen.getByLabelText('Lap cat', { exact: true }))
    review()
    expect(screen.getByRole('heading', { name: 'Your adoption preferences.' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Edit answers' }))
    expect(screen.getByLabelText('When would you be ready to adopt?')).toHaveValue(answers.readiness)
    expect(screen.getByLabelText('Lap cat', { exact: true })).toBeChecked()
    expect(upsert).not.toHaveBeenCalled()
  })
})

describe('adopter quiz persistence specifications (implementation pending)', () => {
  // Checks the load query uses the signed-in user's ID and restores text, radio, and checkbox answers without writing.
  it('restores every saved answer using the authenticated user ID', async () => {
    maybeSingle.mockResolvedValueOnce({ data: { answers }, error: null })
    renderQuiz()
    await waitFor(() => expect(eq).toHaveBeenCalledWith('user_id', userId))
    expect(supabase.from).toHaveBeenCalledWith('adopter_quiz_answers')
    expect(select).toHaveBeenCalledWith('answers')
    expect(await screen.findByLabelText('When would you be ready to adopt?')).toHaveValue(answers.readiness)
    expect(screen.getByLabelText('What kind of environment is your household like?')).toHaveValue(answers.environment)
    for (const value of ['Cat(s)', 'Somewhat experienced', 'Lap cat', answers.age, answers.care, '1']) {
      expect(screen.getByLabelText(value, { exact: true })).toBeChecked()
    }
    expect(screen.getByLabelText('Dog(s)', { exact: true })).not.toBeChecked()
    expect(upsert).not.toHaveBeenCalled()
  })

  // Holds the load request open to check that a loading message appears and the form cannot be submitted yet.
  it('shows a loading state before allowing edits so late saved answers cannot overwrite input', () => {
    maybeSingle.mockReturnValueOnce(new Promise(() => {}))
    renderQuiz()
    expect(screen.getByRole('status')).toHaveTextContent(/loading.*preferences/i)
    expect(screen.queryByRole('button', { name: /Review my answers/ })).not.toBeInTheDocument()
  })

  // Checks review alone does not save; clicking Save sends the answers with the owner's ID and confirms success.
  it('saves a new quiz only after explicit confirmation and shows success', async () => {
    renderQuiz()
    await fillQuiz()
    review()
    expect(upsert).not.toHaveBeenCalled()
    save()
    await waitFor(() => expect(upsert).toHaveBeenCalledExactlyOnceWith(
      { user_id: userId, answers }, { onConflict: 'user_id' },
    ))
    expect(await screen.findByRole('status')).toHaveTextContent(/preferences saved/i)
  })

  // Loads saved answers, changes readiness, and checks the save targets the same user_id with all other answers intact.
  it('edits an existing quiz and replaces the same adopter row rather than inserting duplicates', async () => {
    maybeSingle.mockResolvedValueOnce({ data: { answers }, error: null })
    renderQuiz()
    const input = await screen.findByLabelText('When would you be ready to adopt?')
    await waitFor(() => expect(input).toHaveValue(answers.readiness))
    fireEvent.change(input, { target: { value: 'Next month' } })
    review(); save()
    await waitFor(() => expect(upsert).toHaveBeenCalledExactlyOnceWith(
      { user_id: userId, answers: { ...answers, readiness: 'Next month' } },
      { onConflict: 'user_id' },
    ))
  })

  // Runs for a database rejection and a network exception: both must show an error, retain input, and allow a successful retry.
  it.each(['denied', 'network'])('preserves answers after a %s save failure and allows retry', async failure => {
    if (failure === 'network') upsert.mockRejectedValueOnce(new Error('Offline'))
    else upsert.mockResolvedValueOnce({ data: null, error: { message: 'Access denied' } })
    renderQuiz()
    await fillQuiz(); review(); save()
    expect(await screen.findByRole('alert')).toHaveTextContent(/could not save/i)
    expect(screen.queryByText(/preferences saved/i)).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Edit answers' }))
    expect(screen.getByLabelText('When would you be ready to adopt?')).toHaveValue(answers.readiness)
    expect(screen.getByLabelText('Lap cat', { exact: true })).toBeChecked()
    review(); save()
    await waitFor(() => expect(upsert).toHaveBeenCalledTimes(2))
    expect(await screen.findByRole('status')).toHaveTextContent(/preferences saved/i)
  })

  // Holds the save request open to check Save/Edit are disabled and repeated clicks cannot send another write.
  it('blocks duplicate submissions and editing while a save is pending', async () => {
    let finish
    upsert.mockReturnValueOnce(new Promise(resolve => { finish = resolve }))
    renderQuiz()
    await fillQuiz(); review(); save()
    const saving = screen.getByRole('button', { name: /saving/i })
    expect(saving).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Edit answers' })).toBeDisabled()
    fireEvent.click(saving)
    expect(upsert).toHaveBeenCalledOnce()
    await act(async () => { finish({ data: null, error: null }) })
    expect(screen.getByRole('status')).toHaveTextContent(/preferences saved/i)
  })

  // Checks a failed load shows an error and blocks review; retry must restore saved answers without writing anything.
  it('reports load failure and retries without silently treating an existing quiz as empty', async () => {
    maybeSingle.mockResolvedValueOnce({ data: null, error: { message: 'Offline' } })
      .mockResolvedValueOnce({ data: { answers }, error: null })
    renderQuiz()
    expect(await screen.findByRole('alert')).toHaveTextContent(/could not load/i)
    expect(screen.queryByRole('button', { name: /Review my answers/ })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /retry/i }))
    await waitFor(() => expect(screen.getByLabelText('When would you be ready to adopt?')).toHaveValue(answers.readiness))
    expect(maybeSingle).toHaveBeenCalledTimes(2)
    expect(upsert).not.toHaveBeenCalled()
  })

  // Renders without an authenticated account and checks there is no quiz submission control or database request.
  it('does not read or write quiz answers without a signed-in adopter', async () => {
    renderQuiz({ user: null, role: null })
    expect(screen.queryByRole('button', { name: /Review my answers/ })).not.toBeInTheDocument()
    expect(supabase.from).not.toHaveBeenCalled()
  })
})

// These require a real test database and two authenticated accounts; frontend
// Supabase mocks cannot establish database authorization guarantees.
describe('quiz database authorization (integration setup pending)', () => {
  // Pending integration test: a second adopter must not read or change the first adopter's row through Supabase.
  it.todo('rejects another adopter reading or updating the owner\'s saved answers')
  // Pending integration test: the database must reject a forged owner ID while allowing the real owner's save.
  it.todo('rejects an upsert with a different user_id and permits the owner to save')
  // Pending integration test: anonymous visitors and accounts with other roles must be denied quiz data access.
  it.todo('rejects anonymous and non-adopter access')
})
