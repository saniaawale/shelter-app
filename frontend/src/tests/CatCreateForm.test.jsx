import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import CatCreateForm from '../components/CatCreateForm'
import { supabase } from '../lib/supabase'

vi.mock('../lib/supabase', () => ({ supabase: { from: vi.fn() } }))

const single = vi.fn()
const select = vi.fn(() => ({ single }))
const insert = vi.fn(() => ({ select }))
const newCat = { id: 'synthetic-cat', Name: 'Test Cat', archived_at: null }

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
  it('creates a cat with unknown optional details and a database-generated ID', async () => {
    const { onCreated } = renderForm()
    enterName()
    save()
    await waitFor(() => expect(onCreated).toHaveBeenCalledWith(newCat))
    expect(insert).toHaveBeenCalledExactlyOnceWith({
      Name: 'Test Cat', Age_group: null, personality: null,
      special_needs: null, availability_status: null,
    })
    expect(supabase.from).toHaveBeenCalledWith('Cat Profiles')
  })

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
      Name: 'Test Cat', Age_group: 'Adult', personality: 'Quiet',
      special_needs: 'Test care note', availability_status: 'Available',
    })
  })

  it('rejects whitespace-only names before sending a request', () => {
    renderForm()
    enterName('   ')
    save()
    expect(screen.getByRole('alert')).toHaveTextContent('Enter a cat name.')
    expect(insert).not.toHaveBeenCalled()
  })

  it('lets browser validation reject an empty name', () => {
    renderForm()
    save()
    expect(screen.getByLabelText('Name')).toBeInvalid()
    expect(insert).not.toHaveBeenCalled()
  })

  it('cancels without creating a record', () => {
    const { onCancel } = renderForm()
    enterName()
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(onCancel).toHaveBeenCalledOnce()
    expect(insert).not.toHaveBeenCalled()
  })

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
