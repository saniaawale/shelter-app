import { useState } from 'react'
import AuthLayout from '../components/AuthLayout'

export default function Signup({ navigate }) {
  const [notice, setNotice] = useState('')

  function handleSubmit(event) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    if (form.get('password') !== form.get('confirm-password')) {
      setNotice('Those passwords don’t match yet. Check them and try again.')
      return
    }
    setNotice('Your details are ready. Account creation will be available when shelter sign-in is connected.')
  }

  return (
    <AuthLayout navigate={navigate} heading="Start your story together." description="Create an account to save your favorites and keep your adoption journey in one place." title="Make an account">
      <form onSubmit={handleSubmit} className="auth-form">
        <label>Full name<input name="name" autoComplete="name" placeholder="Your name" required /></label>
        <label>Email address<input name="email" type="email" autoComplete="email" placeholder="you@example.com" required /></label>
        <label>Password<input name="password" type="password" autoComplete="new-password" placeholder="At least 8 characters" minLength="8" required /></label>
        <label>Confirm password<input name="confirm-password" type="password" autoComplete="new-password" placeholder="Type it again" minLength="8" required /></label>
        <button className="primary-button auth-submit" type="submit">Create account <span aria-hidden="true">→</span></button>
      </form>
      {notice && <p className="form-notice" role="status">{notice}</p>}
      <p className="switch-auth">Already have an account? <button type="button" onClick={() => navigate('login')}>Sign in</button></p>
    </AuthLayout>
  )
}
