import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import CatEditForm from '../components/CatEditForm'
import CatCreateForm from '../components/CatCreateForm'
import LinkFosterAccount from '../components/LinkFosterAccount'

export default function ShelterDashboard() {
    const [creating, setCreating] = useState(false)
    const [cats, setCats] = useState([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState('')
    const [editingCat, setEditingCat] = useState(null)
    const [notice, setNotice] = useState('')
    const [showArchived, setShowArchived] = useState(false)
    const [archiveBusyId, setArchiveBusyId] = useState(null)
    const [archiveError, setArchiveError] = useState('')

    useEffect(() => {
        let cancelled = false

        async function loadCats() {
        try {
            const { data, error } = await supabase
            .from('Cat Profiles')
            .select('id, Name, Age_group, personality, special_needs, availability_status, foster_id, archived_at')

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

    function handleCreated(newCat) {
        setCats(currentCats => [newCat, ...currentCats])
        setCreating(false)
        setNotice('Cat created.')
        setShowArchived(false)
    }

    const visibleCats = cats.filter(cat =>
        showArchived ? Boolean(cat.archived_at) : !cat.archived_at
    )
    const actionBusy = creating || editingCat !== null || archiveBusyId !== null

    async function changeArchiveState(cat) {
        if (archiveBusyId !== null) return
        setArchiveBusyId(cat.id)
        setArchiveError('')
        setNotice('')

        try {
            const { data, error } = await supabase
                .from('Cat Profiles')
                .update({ archived_at: cat.archived_at ? null : new Date().toISOString() })
                .eq('id', cat.id)
                .select('id, archived_at')
                .single()

            if (error) throw error
            if (!data) throw new Error('No updated record returned')

            setCats(currentCats => currentCats.map(item =>
                item.id === data.id ? { ...item, ...data } : item
            ))
            setNotice(cat.archived_at ? 'Cat restored.' : 'Cat archived.')
        } catch {
            setArchiveError('Could not update the archive state. Please try again.')
        } finally {
            setArchiveBusyId(null)
        }
    }

    return (
        <main>
        <h1>Shelter dashboard</h1>
        <LinkFosterAccount />

        <button
            type="button"
            disabled={actionBusy || loading || Boolean(error)}
            onClick={() => {
                setNotice('')
                setArchiveError('')
                setCreating(true)
            }}
        >
            Add cat
        </button>

        <button
            type="button"
            aria-pressed={showArchived}
            disabled={actionBusy || loading || Boolean(error)}
            onClick={() => {
                setShowArchived(current => !current)
                setNotice('')
                setArchiveError('')
            }}
        >
            {showArchived ? 'Show current records' : 'Show archived records'}
        </button>

        {creating && (
            <CatCreateForm
                onCreated={handleCreated}
                onCancel={() => setCreating(false)}
            />
        )}

        {notice && <p role="status">{notice}</p>}
        {archiveError && <p role="alert">{archiveError}</p>}

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
        ) : visibleCats.length === 0 ? (
            <p>{showArchived ? 'No archived cat records.' : 'No current cat records are available to your account.'}</p>
        ) : (
            <ul>
            {visibleCats.map(cat => (
                <li key={cat.id}>
                {cat.Name} — {cat.Age_group || 'Age unknown'}
                {' — '}
                {cat.availability_status || 'Availability unknown'}
                <button
                    type="button"
                    aria-label={`Edit ${cat.Name}`}
                    disabled={actionBusy}
                    onClick={() => {
                        setNotice('')
                        setArchiveError('')
                        setEditingCat(cat)
                    }}
                >
                    Edit
                </button>
                <button
                    type="button"
                    aria-label={`${cat.archived_at ? 'Restore' : 'Archive'} ${cat.Name}`}
                    disabled={actionBusy}
                    onClick={() => changeArchiveState(cat)}
                >
                    {archiveBusyId === cat.id ? 'Saving…' : cat.archived_at ? 'Restore' : 'Archive'}
                </button>
                </li>
            ))}
            </ul>
        )}
        </main>
    )
}
