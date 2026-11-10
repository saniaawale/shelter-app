import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import FosterCatForm from '../components/FosterCatForm'
import { supabase } from '../lib/supabase'

vi.mock('../lib/supabase', () => ({ supabase: { from: vi.fn() } }))
const single = vi.fn()
const eq = vi.fn(() => ({ select: vi.fn(() => ({ single })) }))
const update = vi.fn(() => ({ eq }))
const cat = {
  id: 'test-cat', Name: 'Test Cat', personality: 'Quiet', bio: 'Current description',
  original_foster_description: 'Original description', availability_status: 'Available',
}
beforeEach(() => {
  vi.clearAllMocks()
  supabase.from.mockReturnValue({ update })
  single.mockResolvedValue({ data: { ...cat, personality: 'Playful' }, error: null })
})
afterEach(cleanup)
function renderForm() {
  const onSaved = vi.fn()
  const onCancel = vi.fn()
  render(<FosterCatForm cat={cat} onSaved={onSaved} onCancel={onCancel} />)
  return { onSaved, onCancel }
}
function change() {
  fireEvent.change(screen.getByLabelText('Personality'), { target: { value: 'Playful' } })
}
function save() { fireEvent.click(screen.getByRole('button', { name: 'Save details' })) }

describe('foster cat details', () => {
  it('shows existing details and preserves the original description as read-only', () => {
    renderForm()
    expect(screen.getByLabelText('Foster description')).toHaveValue('Current description')
    expect(screen.getByText('Original description')).toBeInTheDocument()
    expect(screen.getByLabelText('Paired (foster observation)')).toHaveValue('')
  })
  it('saves only changed fields by stable cat ID', async () => {
    const { onSaved } = renderForm()
    change(); save()
    await waitFor(() => expect(onSaved).toHaveBeenCalled())
    expect(update).toHaveBeenCalledExactlyOnceWith({ personality: 'Playful' })
    expect(eq).toHaveBeenCalledWith('id', cat.id)
  })
  it('supports false paired observations without treating unknown as false', async () => {
    const { onSaved } = renderForm()
    fireEvent.change(screen.getByLabelText('Paired (foster observation)'), { target: { value: 'false' } })
    save()
    await waitFor(() => expect(onSaved).toHaveBeenCalled())
    expect(update).toHaveBeenCalledWith({ Paired: false })
  })
  it('validates whitespace names before requesting updates', () => {
    renderForm()
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: '  ' } })
    save()
    expect(screen.getByRole('alert')).toHaveTextContent('Enter a cat name')
    expect(update).not.toHaveBeenCalled()
  })
  it('does not write unchanged details', () => {
    const { onCancel } = renderForm()
    save()
    expect(onCancel).toHaveBeenCalledOnce()
    expect(update).not.toHaveBeenCalled()
  })
  it.each(['denied', 'missing', 'network'])('preserves input after %s failure and permits retry', async type => {
    if (type === 'network') single.mockRejectedValueOnce(new Error('Offline'))
    else single.mockResolvedValueOnce({ data: null, error: type === 'denied' ? { message: 'Access denied' } : null })
    const { onSaved } = renderForm()
    change(); save()
    expect(await screen.findByRole('alert')).toHaveTextContent('Could not save details')
    expect(screen.getByLabelText('Personality')).toHaveValue('Playful')
    expect(onSaved).not.toHaveBeenCalled()
    save()
    await waitFor(() => expect(onSaved).toHaveBeenCalled())
  })
  it('disables repeated saves until confirmation', async () => {
    let finish
    single.mockReturnValueOnce(new Promise(resolve => { finish = resolve }))
    const { onSaved } = renderForm()
    change(); save()
    expect(screen.getByRole('button', { name: 'Saving…' })).toBeDisabled()
    expect(screen.getByLabelText('Name')).toBeDisabled()
    fireEvent.click(screen.getByRole('button', { name: 'Saving…' }))
    expect(update).toHaveBeenCalledOnce()
    await act(async () => { finish({ data: cat, error: null }) })
    expect(onSaved).toHaveBeenCalledOnce()
  })
})
