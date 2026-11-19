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
  // Checks guest answers survive quiz-to-matches navigation and the Retake quiz action.
  it('restores quiz answers after matches and Retake quiz', () => {
    renderPage('/quiz', {})
    fireEvent.change(screen.getByLabelText('When would you be ready to adopt?'), { target: { value: 'Next month' } })
    fireEvent.change(screen.getByLabelText('What kind of environment is your household like?'), { target: { value: 'Quiet' } })
    for (const value of ['Cat(s)', 'Somewhat experienced', 'Lap cat', 'Any age is a good age!', 'Very open', '1']) {
      fireEvent.click(screen.getByLabelText(value, { exact: true }))
    }
    fireEvent.click(screen.getByRole('button', { name: /Review my answers/ }))
    fireEvent.click(screen.getByRole('button', { name: 'View matches' }))
    expect(window.location.pathname).toBe('/matches')
    expect(screen.getByRole('heading', { name: 'Your cat matches' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Retake quiz' }))
    expect(window.location.pathname).toBe('/quiz')
    expect(screen.getByLabelText('When would you be ready to adopt?')).toHaveValue('Next month')
    expect(screen.getByLabelText('What kind of environment is your household like?')).toHaveValue('Quiet')
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
