import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { AuthContext } from './authcontext.js'

export default function AuthProvider({ children }) {
    // undefined means Supabase is still checking the initial session.
    const [session, setSession] = useState(undefined)
    const [roleState, setRoleState] = useState({
        userId: null,
        role: null,
        error: '',
    })

    // Receive the initial session and later login/logout changes.
    useEffect(() => {
        const {
        data: { subscription },
        } = supabase.auth.onAuthStateChange((_event, nextSession) => {
        setSession(nextSession)
        })

        return () => subscription.unsubscribe()
    }, [])

    const userId = session?.user?.id ?? null

    // Load the role separately from the authentication callback.
    useEffect(() => {
        if (!userId) return

        let cancelled = false

        async function loadRole() {
        try {
            const { data, error } = await supabase
            .from('user_roles')
            .select('role')
            .eq('user_id', userId)
            .single()

            if (error) throw error

            if (!['adopter', 'foster', 'shelter'].includes(data?.role)) {
            throw new Error('Invalid account role')
            }

            if (!cancelled) {
            setRoleState({
                userId,
                role: data.role,
                error: '',
            })
            }
        } catch {
            if (!cancelled) {
            setRoleState({
                userId,
                role: null,
                error: 'Could not load your account role. Please sign in again.',
            })
            }
        }
        }

        loadRole()

        return () => {
        cancelled = true
        }
    }, [userId])

    async function signOut() {
        const { error } = await supabase.auth.signOut()
        if (error) throw error
    }

    // Never expose a previous account's role to a different user.
    const roleLoaded = Boolean(userId && roleState.userId === userId)

    const value = {
        user: session?.user ?? null,
        role: roleLoaded ? roleState.role : null,
        loading: session === undefined || Boolean(userId && !roleLoaded),
        error: roleLoaded ? roleState.error : '',
        signOut,
    }

    return (
        <AuthContext.Provider value={value}>
        {children}
        </AuthContext.Provider>
    )
    }