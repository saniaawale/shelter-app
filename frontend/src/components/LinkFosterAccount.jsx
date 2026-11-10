import { useState } from 'react'
import { supabase } from '../lib/supabase'

export default function LinkFosterAccount() {
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  async function submit(event) {
    event.preventDefault()
    if (saving) return
    const formElement = event.currentTarget
    const form = new FormData(formElement)
    const name = form.get('name').trim()
    if (!name) { setError('Enter the foster’s name.'); return }
    setSaving(true)
    setError('')
    setNotice('')
    try {
      const { data, error } = await supabase.rpc('link_foster_account', {
        account_email: form.get('email').trim(), foster_name: name,
      })
      if (error || !data?.length) throw error || new Error('No linked profile')
      setNotice('Foster account linked. You can now assign cats to this foster in Edit.')
      formElement.reset()
    } catch {
      setError('Could not link this account. Check that the email belongs to an existing Supabase Auth account with the foster role. Contact your administrator if it is already linked elsewhere.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <details className="foster-panel">
      <summary>Link a foster account</summary>
      <p>Use an existing account with the foster role. Email invitations are not enabled yet.</p>
      <form className="foster-form" onSubmit={submit}>
        <fieldset disabled={saving}>
          <legend>Foster account</legend>
          <label>Foster name<input name="name" required autoComplete="name" /></label>
          <label>Foster account email<input name="email" type="email" required autoComplete="email" /></label>
          <button type="submit">{saving ? 'Linking…' : 'Link account'}</button>
        </fieldset>
        {error && <p role="alert">{error}</p>}
        {notice && <p role="status">{notice}</p>}
      </form>
    </details>
  )
}
