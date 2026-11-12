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
  source_record_id: 'test-cat', Name: 'Test Cat', companionship_style: 'Quiet',
  original_foster_description: 'Original description', availability_status: 'Available',
}
beforeEach(() => {
  vi.clearAllMocks()
  supabase.from.mockReturnValue({ update })
  single.mockResolvedValue({ data: { ...cat, companionship_style: 'Playful' }, error: null })
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
  // Checks the original description is displayed read-only, with no editable description field and unknown pairing left blank.
  it('shows existing details and preserves the original description as read-only', () => {
    renderForm()
    expect(screen.queryByLabelText('Foster description')).not.toBeInTheDocument()
    expect(screen.getByText('Original description')).toBeInTheDocument()
    expect(screen.getByLabelText('Paired (foster observation)')).toHaveValue('')
  })
  // Checks only the changed personality field is sent, using the cat UUID as the update filter.
  it('saves only changed fields by stable cat ID', async () => {
    const { onSaved } = renderForm()
    change(); save()
    await waitFor(() => expect(onSaved).toHaveBeenCalled())
    expect(update).toHaveBeenCalledExactlyOnceWith({ companionship_style: 'Playful' })
    expect(eq).toHaveBeenCalledWith('source_record_id', cat.source_record_id)
  })
  // Checks choosing No saves boolean false rather than confusing it with unknown/null.
  it('supports false paired observations without treating unknown as false', async () => {
    const { onSaved } = renderForm()
    fireEvent.change(screen.getByLabelText('Paired (foster observation)'), { target: { value: 'false' } })
    save()
    await waitFor(() => expect(onSaved).toHaveBeenCalled())
    expect(update).toHaveBeenCalledWith({ bonded_group_ID: false })
  })
  // Checks a whitespace-only cat name shows an error before an update is requested.
  it('validates whitespace names before requesting updates', () => {
    renderForm()
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: '  ' } })
    save()
    expect(screen.getByRole('alert')).toHaveTextContent('Enter a cat name')
    expect(update).not.toHaveBeenCalled()
  })
  // Checks saving unchanged details closes the form without a database write.
  it('does not write unchanged details', () => {
    const { onCancel } = renderForm()
    save()
    expect(onCancel).toHaveBeenCalledOnce()
    expect(update).not.toHaveBeenCalled()
  })
  // Runs denied, missing-record, and network failures to check input survives and the foster can retry saving.
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
  // Holds a save pending to check the form is disabled and duplicate save clicks are ignored.
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
