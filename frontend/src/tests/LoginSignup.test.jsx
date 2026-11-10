import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import LoginSignup from '../components/LoginSignup'
import { supabase } from '../lib/supabase'

vi.mock('../lib/supabase', () => ({
  supabase: {
    auth: { signUp: vi.fn(), signInWithPassword: vi.fn() },
    from: vi.fn(),
  },
}))

const single = vi.fn()
const eq = vi.fn(() => ({ single }))
const select = vi.fn(() => ({ eq }))

beforeEach(() => {
  vi.clearAllMocks()
  supabase.from.mockReturnValue({ select })
  single.mockResolvedValue({ data: { role: 'adopter' }, error: null })
  supabase.auth.signInWithPassword.mockResolvedValue({
    data: { session: {}, user: { id: 'test-user-id' } },
    error: null,
  })
})

afterEach(cleanup)

function fillForm(isSignup = false) {
  fireEvent.change(screen.getByLabelText('Email address'), {
    target: { value: 'test@example.com' },
  })
  fireEvent.change(screen.getByLabelText('Password'), {
    target: { value: 'test-password-123' },
  })
  if (isSignup) {
    fireEvent.change(screen.getByLabelText('Full name'), {
      target: { value: 'Test Adopter' },
    })
    fireEvent.change(screen.getByLabelText('Confirm password'), {
      target: { value: 'test-password-123' },
    })
  }
}

function submit(name) {
  fireEvent.click(screen.getByRole('button', { name }))
}

describe('adopter signup', () => {
  it('rejects mismatched passwords before contacting Supabase', () => {
    const navigate = vi.fn()
    render(<LoginSignup page="signup" navigate={navigate} />)
    fillForm(true)
    fireEvent.change(screen.getByLabelText('Confirm password'), {
      target: { value: 'different-password' },
    })
    submit(/Create account/)

    expect(screen.getByRole('status')).toHaveTextContent('Passwords don’t match')
    expect(supabase.auth.signUp).not.toHaveBeenCalled()
    expect(navigate).not.toHaveBeenCalled()
  })

  it('opens the quiz when signup returns a session', async () => {
    supabase.auth.signUp.mockResolvedValue({ data: { session: {} }, error: null })
    const navigate = vi.fn()
    render(<LoginSignup page="signup" navigate={navigate} />)
    fillForm(true)
    submit(/Create account/)

    await waitFor(() => expect(navigate).toHaveBeenCalledWith('quiz'))
  })

  it('asks for email confirmation instead of navigating without a session', async () => {
    supabase.auth.signUp.mockResolvedValue({ data: { session: null }, error: null })
    const navigate = vi.fn()
    render(<LoginSignup page="signup" navigate={navigate} />)
    fillForm(true)
    submit(/Create account/)

    expect(await screen.findByRole('status')).toHaveTextContent('Check your email')
    expect(navigate).not.toHaveBeenCalled()
  })
})

describe('account login', () => {
  it.each([
    ['adopter', 'quiz'],
    ['foster', 'foster-dashboard'],
    ['shelter', 'shelter-dashboard'],
  ])('routes a %s account to %s', async (role, destination) => {
    single.mockResolvedValue({ data: { role }, error: null })
    const navigate = vi.fn()
    render(<LoginSignup page="login" navigate={navigate} />)
    fillForm()
    submit(/Sign in/)

    await waitFor(() => expect(navigate).toHaveBeenCalledWith(destination))
    expect(eq).toHaveBeenCalledWith('user_id', 'test-user-id')
  })

  it('shows authentication errors and preserves the entered email', async () => {
    supabase.auth.signInWithPassword.mockResolvedValue({
      data: null, error: { message: 'Invalid login credentials' },
    })
    const navigate = vi.fn()
    render(<LoginSignup page="login" navigate={navigate} />)
    fillForm()
    submit(/Sign in/)

    expect(await screen.findByRole('status')).toHaveTextContent('Invalid login credentials')
    expect(screen.getByLabelText('Email address')).toHaveValue('test@example.com')
    expect(supabase.from).not.toHaveBeenCalled()
    expect(navigate).not.toHaveBeenCalled()
  })

  it('does not navigate when loading the role fails', async () => {
    single.mockResolvedValue({ data: null, error: { message: 'Role unavailable' } })
    const navigate = vi.fn()
    render(<LoginSignup page="login" navigate={navigate} />)
    fillForm()
    submit(/Sign in/)

    expect(await screen.findByRole('status')).toHaveTextContent('Please try again')
    expect(navigate).not.toHaveBeenCalled()
  })

  it('does not grant a destination to an unknown role', async () => {
    single.mockResolvedValue({ data: { role: 'unknown' }, error: null })
    const navigate = vi.fn()
    render(<LoginSignup page="login" navigate={navigate} />)
    fillForm()
    submit(/Sign in/)

    expect(await screen.findByRole('status')).toHaveTextContent('Your account role needs setup')
    expect(navigate).not.toHaveBeenCalled()
  })

  it('shows a recoverable error when the connection fails', async () => {
    supabase.auth.signInWithPassword.mockRejectedValue(new Error('Offline'))
    const navigate = vi.fn()
    render(<LoginSignup page="login" navigate={navigate} />)
    fillForm()
    submit(/Sign in/)

    expect(await screen.findByRole('status')).toHaveTextContent('Couldn’t connect')
    expect(navigate).not.toHaveBeenCalled()
  })
})
