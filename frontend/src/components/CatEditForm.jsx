import { useState } from 'react'
import { supabase } from '../lib/supabase'

export default function CatEditForm({ cat, onSaved, onCancel }) {
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

        // Send only fields the staff member changed.
        const changes = Object.fromEntries(
        Object.entries(values).filter(
            ([field, value]) => value !== (cat[field] ?? null)
        )
        )

        if (Object.keys(changes).length === 0) {
        onCancel()
        return
        }

        setSaving(true)
        setError('')

        try {
        const { data, error } = await supabase
            .from('Cat Profiles')
            .update(changes)
            .eq('id', cat.id)
            .select(
            'id, Name, Age_group, personality, special_needs, availability_status'
            )
            .single()

        if (error) throw error
        if (!data) throw new Error('No updated record returned')

        onSaved(data)
        } catch {
        setError('Could not save changes. Your entries are still here; try again.')
        } finally {
        setSaving(false)
        }
    }

    return (
        <section aria-labelledby="edit-cat-heading">
        <h2 id="edit-cat-heading">Edit {cat.Name}</h2>

        <form onSubmit={handleSubmit} className="auth-form">
            <fieldset disabled={saving}>
            <legend>Cat details</legend>

            <label>
                Name
                <input name="name" defaultValue={cat.Name} required />
            </label>

            <label>
                Age group
                <input name="age" defaultValue={cat.Age_group ?? ''} />
            </label>

            <label>
                Personality
                <textarea
                name="personality"
                defaultValue={cat.personality ?? ''}
                />
            </label>

            <label>
                Documented care needs
                <textarea
                name="care"
                defaultValue={cat.special_needs ?? ''}
                />
            </label>

            <label>
                Adoption status
                <input
                name="status"
                defaultValue={cat.availability_status ?? ''}
                />
            </label>

            <button type="submit">
                {saving ? 'Saving…' : 'Save changes'}
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


