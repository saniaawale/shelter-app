import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import CatCreateForm from '../components/CatCreateForm'
import { supabase } from '../lib/supabase'

vi.mock('../lib/supabase', () => ({ supabase: { from: vi.fn() } }))

const single = vi.fn()
const select = vi.fn(() => ({ single }))
const insert = vi.fn(() => ({ select }))
const newCat = { source_record_id: 'synthetic-cat', Name: 'Test Cat', archived_at: null }

beforeEach(() => {
  vi.clearAllMocks()
  supabase.from.mockReturnValue({ insert })
  single.mockResolvedValue({ data: newCat, error: null })
})
afterEach(cleanup)

function renderForm() {
  const onCreated = vi.fn()
  const onCancel = vi.fn()
  render(<CatCreateForm onCreated={onCreated} onCancel={onCancel} />)
  return { onCreated, onCancel }
}

function enterName(value = '  Test Cat  ') {
  fireEvent.change(screen.getByLabelText('Name'), { target: { value } })
}
function save() {
  fireEvent.click(screen.getByRole('button', { name: 'Create cat' }))
}

describe('cat creation', () => {
  // Checks creation sends a unique UUID and name, leaves optional details null, and returns the saved record.
  it('creates a cat with unknown optional details and a unique cat UUID', async () => {
    const { onCreated } = renderForm()
    enterName()
    save()
    await waitFor(() => expect(onCreated).toHaveBeenCalledWith(newCat))
    expect(insert).toHaveBeenCalledExactlyOnceWith({
      source_record_id: expect.stringMatching(/^[0-9a-f-]{36}$/),
      Name: 'Test Cat', age_group: null, companionship_style: null,
      special_needs: null, availability_status: null,
    })
    expect(supabase.from).toHaveBeenCalledWith('Cat Profiles')
  })

  // Checks entered details are trimmed and saved without assigning a foster or setting an archive date.
  it('includes entered details without creating an assignment or an archive timestamp', async () => {
    const { onCreated } = renderForm()
    enterName()
    fireEvent.change(screen.getByLabelText('Age group'), { target: { value: ' Adult ' } })
    fireEvent.change(screen.getByLabelText('Personality'), { target: { value: ' Quiet ' } })
    fireEvent.change(screen.getByLabelText('Documented care needs'), { target: { value: ' Test care note ' } })
    fireEvent.change(screen.getByLabelText('Adoption status'), { target: { value: ' Available ' } })
    save()
    await waitFor(() => expect(onCreated).toHaveBeenCalled())
    expect(insert).toHaveBeenCalledWith({
      source_record_id: expect.stringMatching(/^[0-9a-f-]{36}$/),
      Name: 'Test Cat', age_group: 'Adult', companionship_style: 'Quiet',
      special_needs: 'Test care note', availability_status: 'Available',
    })
  })

  // Checks a whitespace-only name shows validation feedback without sending an insert request.
  it('rejects whitespace-only names before sending a request', () => {
    renderForm()
    enterName('   ')
    save()
    expect(screen.getByRole('alert')).toHaveTextContent('Enter a cat name.')
    expect(insert).not.toHaveBeenCalled()
  })

  // Checks the browser marks an empty required name invalid and prevents a database write.
  it('lets browser validation reject an empty name', () => {
    renderForm()
    save()
    expect(screen.getByLabelText('Name')).toBeInvalid()
    expect(insert).not.toHaveBeenCalled()
  })

  // Checks Cancel closes the form without inserting a cat.
  it('cancels without creating a record', () => {
    const { onCancel } = renderForm()
    enterName()
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(onCancel).toHaveBeenCalledOnce()
    expect(insert).not.toHaveBeenCalled()
  })

  // Holds creation pending to check inputs are disabled and repeated clicks send only one request.
  it('disables duplicate submissions while awaiting confirmation', async () => {
    let finish
    single.mockReturnValueOnce(new Promise(resolve => { finish = resolve }))
    const { onCreated } = renderForm()
    enterName()
    save()
    const pending = screen.getByRole('button', { name: 'Creating…' })
    expect(pending).toBeDisabled()
    expect(screen.getByLabelText('Name')).toBeDisabled()
    fireEvent.click(pending)
    expect(insert).toHaveBeenCalledOnce()
    expect(onCreated).not.toHaveBeenCalled()
    await act(async () => { finish({ data: newCat, error: null }) })
    expect(onCreated).toHaveBeenCalledOnce()
  })

  // Runs database-error, network-error, and missing-record cases to check input survives and a second save succeeds.
  it.each(['database', 'network', 'missing record'])('preserves input and permits retry after %s failure', async type => {
    if (type === 'network') single.mockRejectedValueOnce(new Error('Offline'))
    else single.mockResolvedValueOnce({ data: null, error: type === 'database' ? { message: 'Private details' } : null })
    const { onCreated } = renderForm()
    enterName('Test Cat')
    save()
    expect(await screen.findByRole('alert')).toHaveTextContent('Could not create the cat')
    expect(screen.getByLabelText('Name')).toHaveValue('Test Cat')
    expect(onCreated).not.toHaveBeenCalled()
    save()
    await waitFor(() => expect(onCreated).toHaveBeenCalledWith(newCat))
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })
})
