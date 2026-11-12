import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import FosterDashboard from '../pages/FosterDashboard'
import { AuthContext } from '../context/authcontext.js'
import { supabase } from '../lib/supabase'

vi.mock('../lib/supabase', () => ({ supabase: { from: vi.fn() } }))
vi.mock('../components/CatImages', () => ({ default: ({ catName }) => <p>Photos for {catName}</p> }))

const profile = { foster_id: 'test-foster', Name: 'Test Foster' }
const cat = { source_record_id: 'test-cat', Name: 'Test Cat', special_needs: 'Original notes', original_foster_description: 'Original description', archived_at: null }
const maybeSingle = vi.fn()
const catQuery = vi.fn()
const single = vi.fn()
const update = vi.fn(() => ({ eq: vi.fn(() => ({ select: vi.fn(() => ({ single })) })) }))
const signOut = vi.fn()
const profileEq = vi.fn(() => ({ maybeSingle }))

beforeEach(() => {
  vi.clearAllMocks()
  maybeSingle.mockResolvedValue({ data: profile, error: null })
  catQuery.mockResolvedValue({ data: [cat], error: null })
  single.mockResolvedValue({ data: { ...cat, special_needs: 'Updated notes' }, error: null })
  signOut.mockResolvedValue(undefined)
  supabase.from.mockImplementation(table => table === 'Foster Profiles'
    ? { select: vi.fn(() => ({ eq: profileEq })) }
    : { select: vi.fn(() => ({ eq: catQuery })), update })
})
afterEach(cleanup)

function renderDashboard() {
  const onHome = vi.fn()
  render(<AuthContext.Provider value={{ user: { id: 'test-user' }, signOut }}>
    <FosterDashboard onHome={onHome} />
  </AuthContext.Provider>)
  return { onHome }
}

describe('foster dashboard', () => {
  it('loads the authenticated profile and queries only its assigned cats', async () => {
    renderDashboard()
    expect(await screen.findByRole('button', { name: 'Update Test Cat' })).toBeInTheDocument()
    expect(profileEq).toHaveBeenCalledWith('user_id', 'test-user')
    expect(catQuery).toHaveBeenCalledWith('foster_id', profile.foster_id)
  })

  it('waits for the initial request', () => {
    maybeSingle.mockReturnValueOnce(new Promise(() => {}))
    renderDashboard()
    expect(screen.getByRole('status')).toHaveTextContent('Loading your cats')
  })

  it('explains when the account has not been linked', async () => {
    maybeSingle.mockResolvedValueOnce({ data: null, error: null })
    renderDashboard()
    expect(await screen.findByText(/profile is not linked yet/)).toBeInTheDocument()
    expect(catQuery).not.toHaveBeenCalled()
  })

  it('shows an empty state for a linked foster without cats', async () => {
    catQuery.mockResolvedValueOnce({ data: [], error: null })
    renderDashboard()
    expect(await screen.findByText(/No cats are assigned to you yet/)).toBeInTheDocument()
  })

  it('recovers from a loading failure on retry', async () => {
    catQuery.mockRejectedValueOnce(new Error('Offline'))
    renderDashboard()
    expect(await screen.findByRole('alert')).toHaveTextContent('Could not load your assigned cats')
    fireEvent.click(screen.getByRole('button', { name: 'Retry assigned cats' }))
    expect(await screen.findByRole('button', { name: 'Update Test Cat' })).toBeInTheDocument()
  })

  it('opens saved details and photos without exposing status or assignment controls', async () => {
    renderDashboard()
    fireEvent.click(await screen.findByRole('button', { name: 'Update Test Cat' }))
    expect(screen.getByLabelText('Care observations')).toHaveValue('Original notes')
    expect(screen.getByText('Photos for Test Cat')).toBeInTheDocument()
    expect(screen.queryByLabelText('Adoption status')).not.toBeInTheDocument()
    expect(screen.queryByLabelText('Current foster')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Refresh assigned cats' })).toBeDisabled()
    fireEvent.click(screen.getByRole('button', { name: 'Close details' }))
    expect(screen.queryByLabelText('Care observations')).not.toBeInTheDocument()
  })

  it('keeps saved changes when details are reopened', async () => {
    renderDashboard()
    fireEvent.click(await screen.findByRole('button', { name: 'Update Test Cat' }))
    fireEvent.change(screen.getByLabelText('Care observations'), { target: { value: 'Updated notes' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save details' }))
    expect(await screen.findByText(/Cat details saved/)).toBeInTheDocument()
    expect(update).toHaveBeenCalledWith({ special_needs: 'Updated notes' })
    fireEvent.click(screen.getByRole('button', { name: 'Close details' }))
    fireEvent.click(screen.getByRole('button', { name: 'Update Test Cat' }))
    expect(screen.getByLabelText('Care observations')).toHaveValue('Updated notes')
  })

  it('signs out and returns home', async () => {
    const { onHome } = renderDashboard()
    fireEvent.click(screen.getByRole('button', { name: 'Sign out' }))
    await waitFor(() => expect(onHome).toHaveBeenCalledOnce())
    expect(signOut).toHaveBeenCalledOnce()
  })
})
