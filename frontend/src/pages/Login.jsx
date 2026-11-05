import { useState } from 'react'
import AuthLayout from '../components/AuthLayout'

export default function Login({ navigate }) {
  const [notice, setNotice] = useState('')

  function handleSubmit(event) {
    event.preventDefault()
    setNotice('Your details are ready. Sign-in will be available when shelter accounts are connected.')
  }

  return (
    <AuthLayout navigate={navigate} heading="Welcome back, friend." description="Sign in to pick up where you left off :)" title="Sign in">
      <form onSubmit={handleSubmit} className="auth-form">
        <label>Email address<input name="email" type="email" autoComplete="email" placeholder="you@example.com" required /></label>
        <label>Password<input name="password" type="password" autoComplete="current-password" placeholder="At least 8 characters" minLength="8" required /></label>
        <button className="forgot-link" type="button" onClick={() => setNotice('Ask your shelter team for help resetting your password.')}>Forgot password?</button>
        <button className="primary-button auth-submit" type="submit">Sign in <span aria-hidden="true">→</span></button>
      </form>
      {notice && <p className="form-notice" role="status">{notice}</p>}
      <p className="switch-auth">New around here? <button type="button" onClick={() => navigate('signup')}>Create an account</button></p>
    </AuthLayout>
  )
}
