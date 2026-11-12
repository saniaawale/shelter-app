import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
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

afterEach(() => {
  cleanup()
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
    expect(screen.queryByText('Your shelter tools will appear here.')).not.toBeInTheDocument()
  })

  // Checks a signed-out visitor sees the login form when opening a protected dashboard.
  it('shows login to a signed-out visitor', () => {
    renderPage('/foster-dashboard', {})
    expect(screen.getByRole('heading', { name: 'Login form' })).toBeInTheDocument()
  })

  // Runs for foster and shelter roles to check each can open its own dashboard.
  it.each([
    ['foster', '/foster-dashboard', 'Foster dashboard'],
    ['shelter', '/shelter-dashboard', 'Shelter dashboard'],
  ])('allows a %s account into its dashboard', (role, path, heading) => {
    renderPage(path, { user: { id: 'test-user' }, role })
    expect(screen.getByRole('heading', { name: heading })).toBeInTheDocument()
  })

  // Checks an adopter opening the shelter URL directly receives an access error.
  it('blocks an adopter from a shelter dashboard opened directly', () => {
    renderPage('/shelter-dashboard', { user: { id: 'test-user' }, role: 'adopter' })
    expect(screen.getByRole('alert')).toHaveTextContent('does not have access')
    expect(screen.queryByText('Your shelter tools will appear here.')).not.toBeInTheDocument()
  })

  // Checks a foster account cannot open the adopter quiz.
  it('blocks fosters from the adopter quiz', () => {
    renderPage('/quiz', { user: { id: 'test-user' }, role: 'foster' })
    expect(screen.getByRole('alert')).toHaveTextContent('does not have access')
  })

  // Checks a role lookup failure is shown instead of granting access to protected content.
  it('shows role-loading errors instead of protected content', () => {
    renderPage('/shelter-dashboard', { user: { id: 'test-user' }, error: 'Could not load role.' })
    expect(screen.getByRole('alert')).toHaveTextContent('Could not load role.')
  })
})
