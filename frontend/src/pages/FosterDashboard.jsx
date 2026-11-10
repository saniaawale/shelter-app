import { useContext, useEffect, useState } from 'react'
import { AuthContext } from '../context/authcontext.js'
import { supabase } from '../lib/supabase'
import { FOSTER_CAT_FIELDS } from '../lib/fosterCats'
import FosterCatForm from '../components/FosterCatForm'
import CatImages from '../components/CatImages'

export default function FosterDashboard({ onHome }) {
  const { user, signOut } = useContext(AuthContext)
  const [cats, setCats] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [linked, setLinked] = useState(false)
  const [selected, setSelected] = useState(null)
  const [revision, setRevision] = useState(0)
  const [signingOut, setSigningOut] = useState(false)
  const userId = user?.id

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      setError('')
      try {
        const { data: profile, error: profileError } = await supabase.from('Foster Profiles')
          .select('foster_id, Name').eq('user_id', userId).maybeSingle()
        if (profileError) throw profileError
        if (!profile) {
          if (!cancelled) { setLinked(false); setCats([]) }
          return
        }
        const { data, error } = await supabase.from('Cat Profiles')
          .select(FOSTER_CAT_FIELDS).eq('foster_id', profile.foster_id)
        if (error) throw error
        if (!cancelled) { setLinked(true); setCats(data ?? []) }
      } catch {
        if (!cancelled) setError('Could not load your assigned cats. Please try again.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    if (userId) load()
    return () => { cancelled = true }
  }, [userId, revision])

  async function leave() {
    setSigningOut(true)
    setError('')
    try { await signOut(); onHome?.() }
    catch { setError('Could not sign out. Please try again.') }
    finally { setSigningOut(false) }
  }

  return (
    <main className="foster-dashboard">
      <header className="foster-header">
        <div><p className="eyebrow">Your foster space</p><h1>Foster dashboard</h1></div>
        <button className="outline-button" type="button" disabled={signingOut} onClick={leave}>{signingOut ? 'Signing out…' : 'Sign out'}</button>
      </header>
      <p>Keep your assigned cats’ details and photos up to date.</p>
      {notice && <p role="status">{notice}</p>}
      {loading ? <p role="status">Loading your cats…</p> : error ? (
        <div><p role="alert">{error}</p><button type="button" onClick={() => setRevision(current => current + 1)}>Retry assigned cats</button></div>
      ) : !linked ? <p>Your foster profile is not linked yet. Ask shelter staff to link your account.</p>
        : cats.length === 0 ? <p>No cats are assigned to you yet. Shelter staff will assign your cats here.</p>
          : <ul className="foster-cat-list">{cats.map(cat => (
            <li key={cat.id} className="foster-cat-card">
              <h2>{cat.Name}</h2><p>{cat.Age_group || 'Age unknown'} · {cat.availability_status || 'Availability unknown'}</p>
              {cat.archived_at && <p>Archived record</p>}
              <button className="primary-button" type="button" disabled={selected !== null}
                onClick={() => { setSelected(cat); setNotice('') }}>Update {cat.Name}</button>
            </li>
          ))}</ul>}
      {selected && (
        <div key={selected.id}>
          <FosterCatForm cat={selected} onCancel={() => setSelected(null)} onSaved={saved => {
            setCats(current => current.map(cat => cat.id === saved.id ? { ...cat, ...saved } : cat))
            setSelected(saved)
            setNotice('Cat details saved. You can return and update them anytime.')
          }} />
          <CatImages catId={selected.id} catName={selected.Name} />
        </div>
      )}
      <button className="outline-button" type="button" disabled={loading || selected !== null}
        onClick={() => { setNotice(''); setRevision(current => current + 1) }}>Refresh assigned cats</button>
    </main>
  )
}
