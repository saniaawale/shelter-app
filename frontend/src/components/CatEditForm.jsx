import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

export default function CatEditForm({ cat, onSaved, onCancel }) {
    const [saving, setSaving] = useState(false)
    const [error, setError] = useState('')
    const [fosters, setFosters] = useState([])
    const [fostersLoading, setFostersLoading] = useState(true)
    const [fostersError, setFostersError] = useState('')
    const [selectedFosterId, setSelectedFosterId] = useState(cat.foster_id ?? '')

    useEffect(() => {
    let cancelled = false

    async function loadFosters() {
        try {
        const { data, error } = await supabase
            .from('Foster Profiles')
            .select('foster_id, Name')

        if (error) throw error

        if (!cancelled) setFosters(data ?? [])
        } catch {
        if (!cancelled) {
            setFostersError('Could not load fosters. Close and reopen the form to retry.')
        }
        } finally {
        if (!cancelled) setFostersLoading(false)
        }
    }

    loadFosters()

    return () => {
        cancelled = true
    }
    }, [])

    async function handleSubmit(event) {
        event.preventDefault()
        if (saving) return

        const form = new FormData(event.currentTarget)

        const values = {
        Name: form.get('name').trim(),
        age_group: form.get('age').trim() || null,
        companionship_style: form.get('companionship_style').trim() || null,
        special_needs: form.get('care').trim() || null,
        availability_status: form.get('status').trim() || null,
        }

        // Preserve the existing assignment if the directory could not load.
        if (!fostersLoading && !fostersError) {
        const selectedFoster = selectedFosterId || null
        const currentFoster =
            cat.foster_id == null ? null : String(cat.foster_id)

        if (selectedFoster !== currentFoster) {
            values.foster_id = selectedFoster
        }
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
            .eq('source_record_id', cat.source_record_id)
            .select(
            'source_record_id, Name, age_group, companionship_style, special_needs, availability_status, foster_id'
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
                <input name="age" defaultValue={cat.age_group ?? ''} />
            </label>

            <label>
                Personality
                <textarea
                name="companionship_style"
                defaultValue={cat.companionship_style ?? ''}
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

            <label>
        Current foster
        <select
            name="foster_id"
            value={selectedFosterId}
            onChange={event => setSelectedFosterId(event.target.value)}
            disabled={fostersLoading || Boolean(fostersError)}
        >
            <option value="">Unassigned</option>

            {cat.foster_id != null &&
            !fosters.some(foster => foster.foster_id === cat.foster_id) && (
                <option value={String(cat.foster_id)}>
                Current foster — profile unavailable
                </option>
            )}

            {fosters.map(foster => (
            <option key={foster.foster_id} value={foster.foster_id}>
                {foster.Name}
            </option>
            ))}
        </select>
        </label>

        {fostersLoading && <p role="status">Loading fosters…</p>}
        {fostersError && <p role="alert">{fostersError}</p>}

        {!fostersLoading && !fostersError && fosters.length === 0 && (
        <p>No foster profiles are available for assignment.</p>
        )}

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


