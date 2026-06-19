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
  it('waits for authentication before showing a dashboard', () => {
    renderPage('/shelter-dashboard', { loading: true })
    expect(screen.getByRole('status')).toHaveTextContent('Checking your account')
    expect(screen.queryByText('Your shelter tools will appear here.')).not.toBeInTheDocument()
  })

  it('shows login to a signed-out visitor', () => {
    renderPage('/foster-dashboard', {})
    expect(screen.getByRole('heading', { name: 'Login form' })).toBeInTheDocument()
  })

  it.each([
    ['foster', '/foster-dashboard', 'Foster dashboard'],
    ['shelter', '/shelter-dashboard', 'Shelter dashboard'],
  ])('allows a %s account into its dashboard', (role, path, heading) => {
    renderPage(path, { user: { id: 'test-user' }, role })
    expect(screen.getByRole('heading', { name: heading })).toBeInTheDocument()
  })

  it('blocks an adopter from a shelter dashboard opened directly', () => {
    renderPage('/shelter-dashboard', { user: { id: 'test-user' }, role: 'adopter' })
    expect(screen.getByRole('alert')).toHaveTextContent('does not have access')
    expect(screen.queryByText('Your shelter tools will appear here.')).not.toBeInTheDocument()
  })

  it('blocks fosters from the adopter quiz', () => {
    renderPage('/quiz', { user: { id: 'test-user' }, role: 'foster' })
    expect(screen.getByRole('alert')).toHaveTextContent('does not have access')
  })

  it('shows role-loading errors instead of protected content', () => {
    renderPage('/shelter-dashboard', { user: { id: 'test-user' }, error: 'Could not load role.' })
    expect(screen.getByRole('alert')).toHaveTextContent('Could not load role.')
  })
})
