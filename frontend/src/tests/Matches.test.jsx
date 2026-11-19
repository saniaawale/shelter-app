import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import Matches from '../pages/Matches'
import { loadQuizAnswers, saveQuizAnswers } from '../lib/guestQuiz'

const answers = {
  readiness: 'Next month', environment: 'Quiet', household: [],
  experience: 'Somewhat experienced', temperaments: ['Lap cat'],
  age: 'Any age is a good age!', care: 'Very open', count: '1',
}
const cat = (id, name, score) => ({ source_record_id: id, name, score,
  reasons: ['Matches your preferred companionship style: lap_cat.'], considerations: [] })
const response = data => ({ ok: true, json: async () => data })

beforeEach(() => {
  sessionStorage.clear()
  vi.stubGlobal('fetch', vi.fn())
})
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.useRealTimers() })

// Checks a direct visit with incomplete answers prompts the quiz without making an API request.
it('asks visitors with no completed quiz to take it', () => {
  // Start without saved answers and open the public page.
  const navigate = vi.fn()
  render(<Matches navigate={navigate} />)
  fireEvent.click(screen.getByRole('button', { name: 'Retake quiz' }))
  // Missing data must not be sent as an invalid matching request.
  expect(screen.getByRole('status')).toHaveTextContent('Complete the quiz')
  expect(fetch).not.toHaveBeenCalled()
  expect(navigate).toHaveBeenCalledWith('quiz')
})

// Checks saved answers are posted and both ranked result groups retain the backend's ordering.
it('loads ranked matches and separately displays unresolved candidates', async () => {
  // Delay the response to make the loading state observable, using only fictional cats.
  saveQuizAnswers(answers)
  let resolve
  fetch.mockReturnValue(new Promise(done => { resolve = done }))
  render(<Matches navigate={vi.fn()} />)
  expect(screen.getByRole('status')).toHaveTextContent('Finding your cat matches')
  const pending = { ...cat('c', 'Test Unresolved', 3), considerations: ['Needs confirmation: age group.'] }
  await act(async () => resolve(response({ matches: [cat('a', 'Test First', 5), cat('b', 'Test Second', 2)], needs_confirmation: [pending] })))
  // Verify the exact request and visible ranking, reasons, scores, and unresolved information.
  expect(fetch).toHaveBeenCalledWith('/api/matches', expect.objectContaining({ method: 'POST' }))
  expect(JSON.parse(fetch.mock.calls[0][1].body)).toEqual(answers)
  const matches = screen.getByRole('region', { name: 'Preference matches' })
  expect(within(matches).getAllByRole('heading', { level: 3 }).map(item => item.textContent)).toEqual(['Test First', 'Test Second'])
  expect(within(matches).getByText('5 points')).toBeInTheDocument()
  expect(within(matches).getAllByText(/Matches your preferred companionship/)).toHaveLength(2)
  expect(within(screen.getByRole('region', { name: 'Needs confirmation' })).getByText('Needs confirmation: age group.')).toBeInTheDocument()
  expect(screen.getByText(/not adoption approvals/)).toBeInTheDocument()
})

// Checks a successful empty response is distinguished from network or service failure.
it('shows a useful empty state without inventing cats', async () => {
  // Supply complete guest answers and a valid response containing no candidates.
  fetch.mockResolvedValue(response({ matches: [], needs_confirmation: [] }))
  render(<Matches quizAnswers={answers} navigate={vi.fn()} />)
  // The visitor can retake the quiz, but no fictional recommendation is inserted.
  expect(await screen.findByText(/No eligible cats were returned/)).toBeInTheDocument()
  expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  expect(screen.queryAllByRole('heading', { level: 3 })).toHaveLength(0)
})

// Checks service failures retain answers and retry the same request successfully.
it('recovers from service failure without losing quiz answers', async () => {
  // Fail once, then return a fictional result on the visitor's explicit retry.
  saveQuizAnswers(answers)
  fetch.mockResolvedValueOnce({ ok: false, status: 503 }).mockResolvedValueOnce(response({ matches: [cat('a', 'Test Retry', 5)], needs_confirmation: [] }))
  render(<Matches navigate={vi.fn()} />)
  expect(await screen.findByRole('alert')).toHaveTextContent('Could not load')
  fireEvent.click(screen.getByRole('button', { name: 'Try again' }))
  // Recovery must show results with the same answers and leave saved input untouched.
  expect(await screen.findByRole('heading', { name: 'Test Retry' })).toBeInTheDocument()
  expect(fetch).toHaveBeenCalledTimes(2)
  expect(JSON.parse(fetch.mock.calls[1][1].body)).toEqual(answers)
  expect(loadQuizAnswers()).toEqual(answers)
})

// Checks validation failures, invalid response shapes, and network failures all allow recovery.
it.each(['validation', 'malformed', 'network'])('handles %s errors safely', async kind => {
  // Simulate each transport failure without depending on a running backend.
  if (kind === 'validation') fetch.mockResolvedValue({ ok: false, status: 422 })
  if (kind === 'malformed') fetch.mockResolvedValue(response({ matches: [{}], needs_confirmation: [] }))
  if (kind === 'network') fetch.mockRejectedValue(new TypeError('private transport detail'))
  render(<Matches quizAnswers={answers} navigate={vi.fn()} />)
  // Users see a safe message and retry rather than raw exceptions or a crashed screen.
  expect(await screen.findByRole('alert')).not.toHaveTextContent('private transport detail')
  expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument()
})

// Checks a stalled request settles into an error instead of leaving an indefinite loading message.
it('times out stalled matching requests', async () => {
  // Make the mocked transport behave like fetch when its signal is aborted.
  vi.useFakeTimers()
  fetch.mockImplementation((_url, { signal }) => new Promise((_resolve, reject) => {
    signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')))
  }))
  render(<Matches quizAnswers={answers} navigate={vi.fn()} />)
  await act(async () => { await vi.advanceTimersByTimeAsync(15000) })
  // Timeout is actionable and the loading state is gone.
  expect(screen.getByRole('alert')).toHaveTextContent('took too long')
  expect(screen.queryByText('Finding your cat matches…')).not.toBeInTheDocument()
})

// Checks leaving the results page cancels its request so stale responses cannot affect another page.
it('aborts matching when the page unmounts', () => {
  // Keep a request pending and capture the signal supplied to fetch.
  fetch.mockReturnValue(new Promise(() => {}))
  const view = render(<Matches quizAnswers={answers} navigate={vi.fn()} />)
  const signal = fetch.mock.calls[0][1].signal
  view.unmount()
  // Cleanup must cancel the request without waiting for its timeout.
  expect(signal.aborted).toBe(true)
})
