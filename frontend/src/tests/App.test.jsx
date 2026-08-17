import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import App from '../App'
import { AuthContext } from '../context/authcontext.js'

vi.mock('../lib/supabase', () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn().mockResolvedValue({ data: [], error: null }),
    })),
  },
}))

vi.mock('../components/LoginSignup', () => ({
  default: () => <h1>Login form</h1>,
}))

beforeEach(() => {
  sessionStorage.clear()
  vi.spyOn(window, 'scrollTo').mockImplementation(() => {})
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  window.history.replaceState({}, '', '/')
})

function renderPage(path, auth) {
  window.history.replaceState({}, '', path)
  render(
    <AuthContext.Provider value={{ user: null, role: null, loading: false, error: '', ...auth }}>
      <App />
    </AuthContext.Provider>
  )
}

describe('protected pages', () => {
  // Checks the account-loading message appears while authentication is unresolved.
  it('waits for authentication before showing a dashboard', () => {
    renderPage('/shelter-dashboard', { loading: true })
    expect(screen.getByRole('status')).toHaveTextContent('Checking your account')
    expect(screen.queryByRole('heading', { name: 'Shelter dashboard' })).not.toBeInTheDocument()
  })

  // Checks a signed-out visitor sees the login form when opening a protected dashboard.
  it('shows login to a signed-out visitor', () => {
    renderPage('/foster-dashboard', {})
    expect(screen.getByRole('heading', { name: 'Login form' })).toBeInTheDocument()
  })

  // Runs for foster, shelter, and adopter roles to check each can open its own dashboard.
  it.each([
    ['foster', '/foster-dashboard', 'Foster dashboard'],
    ['shelter', '/shelter-dashboard', 'Shelter dashboard'],
    ['adopter', '/adopter-dashboard', 'Bookmarked cats'],
  ])('allows a %s account into its dashboard', (role, path, heading) => {
    renderPage(path, { user: { id: 'test-user' }, role })
    expect(screen.getByRole('heading', { name: heading })).toBeInTheDocument()
  })

  // Checks an adopter opening the shelter URL directly receives an access error.
  it('blocks an adopter from a shelter dashboard opened directly', () => {
    renderPage('/shelter-dashboard', { user: { id: 'test-user' }, role: 'adopter' })
    expect(screen.getByRole('alert')).toHaveTextContent('does not have access')
    expect(screen.queryByRole('heading', { name: 'Shelter dashboard' })).not.toBeInTheDocument()
  })

  // Checks a foster cannot open the private adopter bookmarks dashboard.
  it('blocks fosters from the adopter dashboard', () => {
    renderPage('/adopter-dashboard', { user: { id: 'test-user' }, role: 'foster' })
    expect(screen.getByRole('alert')).toHaveTextContent('does not have access')
  })

  // Checks a role lookup failure is shown instead of granting access to protected content.
  it('shows role-loading errors instead of protected content', () => {
    renderPage('/shelter-dashboard', { user: { id: 'test-user' }, error: 'Could not load role.' })
    expect(screen.getByRole('alert')).toHaveTextContent('Could not load role.')
  })
})

describe('public adopter pages and private bookmarks', () => {
  // Checks the complete guest journey works when browser storage cannot save any answers.
  it('passes quiz answers to matches and back while storage is blocked', async () => {
    // Keep the transport mocked and make both browser-storage operations fail.
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('Blocked') })
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('Blocked') })
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true, json: async () => ({ matches: [], needs_confirmation: [] }),
    })
    renderPage('/quiz', {})
    // Complete and review the quiz with no authenticated account or stored fallback.
    for (const value of ['Within 1 month', 'Quiet', 'Somewhat experienced', 'Lap cat', 'Any age is a good age!', 'Very open', '1']) {
      fireEvent.click(screen.getByLabelText(value, { exact: true }))
    }
    fireEvent.click(screen.getByRole('button', { name: /Review my answers/ }))
    fireEvent.click(screen.getByRole('button', { name: 'View matches' }))
    // The request must contain the in-memory answers and finish with a valid empty state.
    expect(await screen.findByText(/No eligible cats were returned/)).toBeInTheDocument()
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toMatchObject({ readiness: 'Within 1 month', environment: 'Quiet' })
    fireEvent.click(screen.getByRole('button', { name: 'Retake quiz' }))
    // Retaking restores the memory copy despite storage remaining unavailable.
    expect(screen.getByRole('radio', { name: 'Within 1 month', exact: true })).toBeChecked()
    expect(screen.getByRole('radio', { name: 'Quiet', exact: true })).toBeChecked()
  })
  // Checks guest answers survive quiz-to-matches navigation and the Retake quiz action.
  it('restores quiz answers after matches and Retake quiz', () => {
    // Complete the guest quiz using the newly approved readiness/environment radios.
    renderPage('/quiz', {})
    fireEvent.click(screen.getByRole('radio', { name: 'Within 1 month', exact: true }))
    fireEvent.click(screen.getByRole('radio', { name: 'Quiet', exact: true }))
    for (const value of ['Cat(s)', 'Somewhat experienced', 'Lap cat', 'Any age is a good age!', 'Very open', '1']) {
      fireEvent.click(screen.getByLabelText(value, { exact: true }))
    }
    fireEvent.click(screen.getByRole('button', { name: /Review my answers/ }))
    fireEvent.click(screen.getByRole('button', { name: 'View matches' }))
    expect(window.location.pathname).toBe('/matches')
    expect(screen.getByRole('heading', { name: 'Your cat matches' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Retake quiz' }))
    // Returning from matches must restore the selected options rather than typed inputs.
    expect(window.location.pathname).toBe('/quiz')
    expect(screen.getByRole('radio', { name: 'Within 1 month', exact: true })).toBeChecked()
    expect(screen.getByRole('radio', { name: 'Quiet', exact: true })).toBeChecked()
    expect(screen.getByLabelText('Cat(s)', { exact: true })).toBeChecked()
    expect(screen.getByLabelText('Lap cat', { exact: true })).toBeChecked()
  })
  // Checks guests can open both quiz and matches without waiting for authentication.
  it.each([
    ['/quiz', 'Adoption Inquiry Form'],
    ['/matches', 'Your cat matches'],
  ])('opens public route %s without login', (path, heading) => {
    renderPage(path, { loading: true })
    expect(screen.getByRole('heading', { name: heading })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Login form' })).not.toBeInTheDocument()
  })

  // Checks requesting saved bookmarks as a guest leads to login.
  it('requires login for the adopter dashboard', () => {
    renderPage('/adopter-dashboard', {})
    expect(screen.getByRole('heading', { name: 'Login form' })).toBeInTheDocument()
  })

  // Checks the dashboard offers bookmarks and quiz navigation without displaying matching results.
  it('keeps matches separate from the bookmarks dashboard', () => {
    renderPage('/adopter-dashboard', { user: { id: 'test-adopter' }, role: 'adopter' })
    expect(screen.getByRole('heading', { name: 'Bookmarked cats' })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Your cat matches' })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Retake quiz' }))
    expect(window.location.pathname).toBe('/quiz')
    expect(screen.getByRole('heading', { name: 'Adoption Inquiry Form' })).toBeInTheDocument()
  })

  // Checks the home-page adoption action opens the public quiz rather than signup.
  it('starts the quiz from Find your match', () => {
    renderPage('/', {})
    fireEvent.click(screen.getByRole('button', { name: /Find your match/ }))
    expect(window.location.pathname).toBe('/quiz')
  })

  // Checks the matches page sends visitors to the protected bookmarks route when they request saved cats.
  it('requires login when a guest opens My bookmarks from matches', () => {
    renderPage('/matches', {})
    fireEvent.click(screen.getByRole('button', { name: 'My bookmarks' }))
    expect(window.location.pathname).toBe('/adopter-dashboard')
    expect(screen.getByRole('heading', { name: 'Login form' })).toBeInTheDocument()
  })
})
