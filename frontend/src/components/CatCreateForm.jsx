import { useState } from 'react'
import { supabase } from '../lib/supabase'

export default function CatCreateForm({ onCreated, onCancel }) {
    const [saving, setSaving] = useState(false)
    const [error, setError] = useState('')

    async function handleSubmit(event) {
        event.preventDefault()
        if (saving) return

        const form = new FormData(event.currentTarget)
        const values = {
        Name: form.get('name').trim(),
        Age_group: form.get('age').trim() || null,
        personality: form.get('personality').trim() || null,
        special_needs: form.get('care').trim() || null,
        availability_status: form.get('status').trim() || null,
        }

        if (!values.Name) {
        setError('Enter a cat name.')
        return
        }

        setSaving(true)
        setError('')

        try {
        const { data, error } = await supabase
            .from('Cat Profiles')
            .insert(values)
            .select(
            'id, Name, Age_group, personality, special_needs, availability_status, foster_id, archived_at'
            )
            .single()

        if (error) throw error
        if (!data) throw new Error('No record returned')

        onCreated(data)
        } catch {
        setError('Could not create the cat. Your entries are still here.')
        } finally {
        setSaving(false)
        }
    }

    return (
        <section aria-labelledby="create-cat-heading">
        <h2 id="create-cat-heading">Add cat</h2>

        <form className="auth-form" onSubmit={handleSubmit}>
            <fieldset disabled={saving}>
            <legend>Cat details</legend>

            <label>
                Name
                <input name="name" required />
            </label>

            <label>
                Age group
                <input name="age" />
            </label>

            <label>
                Personality
                <textarea name="personality" />
            </label>

            <label>
                Documented care needs
                <textarea name="care" />
            </label>

            <label>
                Adoption status
                <input name="status" />
            </label>

            <button type="submit">
                {saving ? 'Creating…' : 'Create cat'}
            </button>

            <button type="button" onClick={onCancel}>
                Cancel
            </button>
            </fieldset>

            {error && <p role="alert">{error}</p>}
        </form>
        </section>
    )
}