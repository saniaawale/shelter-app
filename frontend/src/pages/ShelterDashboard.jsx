import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import CatEditForm from '../components/CatEditForm'

    export default function ShelterDashboard() {
    const [cats, setCats] = useState([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState('')
    const [editingCat, setEditingCat] = useState(null)
    const [notice, setNotice] = useState('')

    useEffect(() => {
        let cancelled = false

        async function loadCats() {
        try {
            const { data, error } = await supabase
            .from('Cat Profiles')
            .select('id, Name, Age_group, personality, special_needs, availability_status')

            if (error) throw error

            if (!cancelled) setCats(data ?? [])
        } catch {
            if (!cancelled) setError('Could not load cats. Please try again.')
        } finally {
            if (!cancelled) setLoading(false)
        }
        }

        loadCats()

        return () => {
        cancelled = true
        }
    }, [])

    function handleSaved(updatedCat) {
        setCats(currentCats =>
            currentCats.map(cat =>
            cat.id === updatedCat.id ? { ...cat, ...updatedCat } : cat
            )
        )
        setEditingCat(null)
        setNotice('Cat details saved.')
    }

    return (
        <main>
        <h1>Shelter dashboard</h1>

        {notice && <p role="status">{notice}</p>}

        {editingCat && (
            <CatEditForm
                key={editingCat.id}
                cat={editingCat}
                onSaved={handleSaved}
                onCancel={() => setEditingCat(null)}
            />
        )}

        {loading ? (
            <p role="status">Loading cats…</p>
        ) : error ? (
            <p role="alert">{error}</p>
        ) : cats.length === 0 ? (
            <p>No cat records are available to your account.</p>
        ) : (
            <ul>
            {cats.map(cat => (
                <li key={cat.id}>
                {cat.Name} — {cat.Age_group || 'Age unknown'}
                {' — '}
                {cat.availability_status || 'Availability unknown'}
                <button
                    type="button"
                    aria-label={`Edit ${cat.Name}`}
                    disabled={editingCat !== null}
                    onClick={() => {
                        setNotice('')
                        setEditingCat(cat)
                    }}
                >
                    Edit
                </button>
                </li>
            ))}
            </ul>
        )}
        </main>
    )
}
