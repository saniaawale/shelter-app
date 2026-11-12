import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import CatEditForm from '../components/CatEditForm'
import { supabase } from '../lib/supabase'

vi.mock('../lib/supabase', () => ({ supabase: { from: vi.fn() } }))

const fosterSelect = vi.fn()
const single = vi.fn()
const select = vi.fn(() => ({ single }))
const eq = vi.fn(() => ({ select }))
const update = vi.fn(() => ({ eq }))

// Synthetic data only; the name is deliberately not used as an identifier.
const cat = {
  source_record_id: 'test-cat-2',
  Name: 'Test Cat',
  age_group: 'Adult',
  companionship_style: 'Quiet',
  special_needs: null,
  availability_status: 'Available',
}

beforeEach(() => {
  vi.clearAllMocks()
  fosterSelect.mockResolvedValue({
    data: [
      { foster_id: '11111111-1111-4111-8111-111111111111', Name: 'Test Foster One' },
      { foster_id: '22222222-2222-4222-8222-222222222222', Name: 'Test Foster Two' },
    ],
    error: null,
  })
  supabase.from.mockImplementation(table => {
    if (table === 'Foster Profiles') return { select: fosterSelect }
    if (table === 'Cat Profiles') return { update }
    throw new Error('Unexpected test table')
  })
  single.mockResolvedValue({ data: { ...cat, availability_status: 'Adopted' }, error: null })
})

afterEach(cleanup)

function renderForm(record = cat) {
  const onSaved = vi.fn()
  const onCancel = vi.fn()
  render(<CatEditForm cat={record} onSaved={onSaved} onCancel={onCancel} />)
  return { onSaved, onCancel }
}

function changeStatus(value = 'Adopted') {
  fireEvent.change(screen.getByLabelText('Adoption status'), { target: { value } })
}

function save() {
  fireEvent.click(screen.getByRole('button', { name: 'Save changes' }))
}

describe('cat editing', () => {
  it.each([
    [null, '11111111-1111-4111-8111-111111111111'],
    ['11111111-1111-4111-8111-111111111111', '22222222-2222-4222-8222-222222222222'],
    ['11111111-1111-4111-8111-111111111111', ''],
  ])('saves foster assignment changes from %s to %s', async (current, next) => {
    const savedCat = { ...cat, foster_id: next || null }
    single.mockResolvedValue({ data: savedCat, error: null })
    const { onSaved } = renderForm({ ...cat, foster_id: current })
    const dropdown = screen.getByLabelText('Current foster')
    await waitFor(() => expect(dropdown).toBeEnabled())
    expect(dropdown).toHaveValue(current || '')
    fireEvent.change(dropdown, { target: { value: next } })
    save()
    await waitFor(() => expect(onSaved).toHaveBeenCalledWith(savedCat))
    expect(update).toHaveBeenCalledExactlyOnceWith({ foster_id: next || null })
    expect(fosterSelect).toHaveBeenCalledWith('foster_id, Name')
  })

  it('populates the existing details and leaves unknown care needs blank', () => {
    renderForm()
    expect(screen.getByLabelText('Name')).toHaveValue('Test Cat')
    expect(screen.getByLabelText('Age group')).toHaveValue('Adult')
    expect(screen.getByLabelText('Personality')).toHaveValue('Quiet')
    expect(screen.getByLabelText('Documented care needs')).toHaveValue('')
    expect(screen.getByLabelText('Adoption status')).toHaveValue('Available')
  })

  it('saves only changed fields by stable cat ID and returns the confirmed record', async () => {
    const { onSaved } = renderForm()
    changeStatus('  Adopted  ')
    save()

    await waitFor(() => expect(onSaved).toHaveBeenCalledWith({ ...cat, availability_status: 'Adopted' }))
    expect(supabase.from).toHaveBeenCalledWith('Cat Profiles')
    expect(update).toHaveBeenCalledExactlyOnceWith({ availability_status: 'Adopted' })
    expect(eq).toHaveBeenCalledWith('source_record_id', 'test-cat-2')
  })

  it('preserves unknown values when an optional field is cleared', async () => {
    const { onSaved } = renderForm()
    fireEvent.change(screen.getByLabelText('Age group'), { target: { value: ' ' } })
    save()

    await waitFor(() => expect(onSaved).toHaveBeenCalled())
    expect(update).toHaveBeenCalledWith({ age_group: null })
  })

  it('rejects a name containing only whitespace without making a request', () => {
    const { onSaved } = renderForm()
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: '   ' } })
    save()

    expect(screen.getByRole('alert')).toHaveTextContent('Enter a cat name.')
    expect(update).not.toHaveBeenCalled()
    expect(onSaved).not.toHaveBeenCalled()
  })

  it('cancels without saving', () => {
    const { onCancel } = renderForm()
    changeStatus()
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))

    expect(onCancel).toHaveBeenCalledOnce()
    expect(update).not.toHaveBeenCalled()
  })

  it('closes an unchanged form without writing to the database', () => {
    const { onCancel } = renderForm()
    save()
    expect(onCancel).toHaveBeenCalledOnce()
    expect(update).not.toHaveBeenCalled()
  })

  it('disables editing and repeated saves until the server confirms success', async () => {
    let resolveSave
    single.mockReturnValue(new Promise(resolve => { resolveSave = resolve }))
    const { onSaved } = renderForm()
    changeStatus()
    save()

    const savingButton = screen.getByRole('button', { name: 'Saving…' })
    expect(savingButton).toBeDisabled()
    expect(screen.getByLabelText('Name')).toBeDisabled()
    fireEvent.click(savingButton)
    expect(update).toHaveBeenCalledTimes(1)
    expect(onSaved).not.toHaveBeenCalled()

    await act(async () => {
      resolveSave({ data: { ...cat, availability_status: 'Adopted' }, error: null })
    })
    expect(onSaved).toHaveBeenCalledOnce()
    expect(screen.getByRole('button', { name: 'Save changes' })).toBeEnabled()
  })

  it.each(['database', 'network', 'missing record'])(
    'preserves input and allows retry after a %s failure', async failure => {
      if (failure === 'network') {
        single.mockRejectedValueOnce(new Error('Offline'))
      } else {
        single.mockResolvedValueOnce({
          data: null,
          error: failure === 'database' ? { message: 'Internal details' } : null,
        })
      }
      const { onSaved } = renderForm()
      changeStatus()
      save()

      expect(await screen.findByRole('alert')).toHaveTextContent('Could not save changes')
      expect(screen.getByLabelText('Adoption status')).toHaveValue('Adopted')
      expect(screen.getByRole('button', { name: 'Save changes' })).toBeEnabled()
      expect(onSaved).not.toHaveBeenCalled()

      save()
      await waitFor(() => expect(onSaved).toHaveBeenCalledOnce())
      expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    }
  )
})
