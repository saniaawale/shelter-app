import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { FOSTER_CAT_FIELDS } from '../lib/fosterCats'

export default function FosterCatForm({ cat, onSaved, onCancel }) {
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function submit(event) {
    event.preventDefault()
    if (saving) return
    const form = new FormData(event.currentTarget)
    const values = Object.fromEntries(
      ['Name', 'age_group', 'companionship_style', 'good_with_dogs', 'special_needs', 'instagram_handle']
        .map(field => [field, form.get(field).trim() || null])
    )
    values.bonded_group_ID = form.get('bonded_group_ID') === '' ? null : form.get('bonded_group_ID') === 'true'
    if (!values.Name) {
      setError('Enter a cat name.')
      return
    }
    const changes = Object.fromEntries(Object.entries(values)
      .filter(([key, value]) => value !== (cat[key] ?? null)))
    if (!Object.keys(changes).length) {
      onCancel()
      return
    }
    setSaving(true)
    setError('')
    try {
      const { data, error } = await supabase.from('Cat Profiles')
        .update(changes).eq('source_record_id', cat.source_record_id).select(FOSTER_CAT_FIELDS).single()
      if (error || !data) throw error || new Error('Cat unavailable')
      onSaved(data)
    } catch {
      setError('Could not save details. Your entries are still here. Your assignment may have changed; contact shelter staff if this continues.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className="foster-panel" aria-labelledby="foster-edit-heading">
      <h2 id="foster-edit-heading">Update {cat.Name}</h2>
      <p>Describe what you have observed. Shelter staff confirm care and placement assessments.</p>
      <p>Adoption status: {cat.availability_status || 'Unknown'}. Assignments and adoption status are managed by shelter staff.</p>
      <form onSubmit={submit} className="foster-form">
        <fieldset disabled={saving}>
          <legend>Cat details</legend>
          <label>Name<input name="Name" defaultValue={cat.Name} required /></label>
          <label>Age group<input name="age_group" defaultValue={cat.age_group ?? ''} /></label>
          <label>Personality<textarea name="companionship_style" defaultValue={cat.companionship_style ?? ''} /></label>
          <label>Observations around dogs<textarea name="good_with_dogs" defaultValue={cat.good_with_dogs ?? ''} /></label>
          <label>Care observations<textarea name="special_needs" defaultValue={cat.special_needs ?? ''} /></label>
          <label>Instagram handle<input name="instagram_handle" defaultValue={cat.instagram_handle ?? ''} /></label>
          <label>Paired (foster observation)
            <select name="bonded_group_ID" defaultValue={cat.bonded_group_ID == null ? '' : String(cat.bonded_group_ID)}>
              <option value="">Unknown</option><option value="true">Yes</option><option value="false">No</option>
            </select>
          </label>
          <div className="foster-actions">
            <button className="primary-button" type="submit">{saving ? 'Saving…' : 'Save details'}</button>
            <button className="outline-button" type="button" onClick={onCancel}>Close details</button>
          </div>
        </fieldset>
        {error && <p role="alert">{error}</p>}
      </form>
      {cat.original_foster_description && (
        <details><summary>Original foster description</summary><p>{cat.original_foster_description}</p></details>
      )}
    </section>
  )
}
