import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import ShelterDashboard from '../pages/ShelterDashboard'
import { supabase } from '../lib/supabase'

vi.mock('../lib/supabase', () => ({
  supabase: { from: vi.fn() },
}))

const select = vi.fn()
const single = vi.fn()
const updateSelect = vi.fn(() => ({ single }))
const eq = vi.fn(() => ({ select: updateSelect }))
const update = vi.fn(() => ({ eq }))
const insert = vi.fn(() => ({ select: updateSelect }))

beforeEach(() => {
  vi.clearAllMocks()
  select.mockReset()
  single.mockReset()
  supabase.from.mockReturnValue({ select, update, insert })
})

afterEach(cleanup)

describe('shelter cat records', () => {
  const currentCat = {
    source_record_id: 'test-cat-current', Name: 'Current Test Cat', availability_status: 'Adopted',
    foster_id: 'test-foster', archived_at: null,
  }
  const archivedCat = {
    source_record_id: 'test-cat-archived', Name: 'Archived Test Cat', availability_status: 'Available',
    archived_at: '2026-01-01T00:00:00Z',
  }

  async function renderRecords() {
    select.mockResolvedValue({ data: [currentCat, archivedCat], error: null })
    render(<ShelterDashboard />)
    await screen.findByRole('button', { name: 'Archive Current Test Cat' })
  }

  it('shows unavailable current cats and provides access to archived cats separately', async () => {
    await renderRecords()
    expect(screen.getByRole('listitem')).toHaveTextContent('Current Test Cat — Age unknown — Adopted')
    expect(screen.queryByText(/Archived Test Cat/)).not.toBeInTheDocument()
    // Assignment remains in the edit form, not the dashboard list.
    expect(screen.queryByText(/test-foster/)).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Show archived records' }))
    expect(screen.getByRole('listitem')).toHaveTextContent('Archived Test Cat')
    expect(screen.queryByRole('button', { name: 'Archive Current Test Cat' })).not.toBeInTheDocument()
  })

  it('archives and restores by ID without changing adoption status or foster assignment', async () => {
    await renderRecords()
    const timestamp = '2026-02-01T00:00:00Z'
    single.mockResolvedValueOnce({ data: { source_record_id: currentCat.source_record_id, archived_at: timestamp }, error: null })
    fireEvent.click(screen.getByRole('button', { name: 'Archive Current Test Cat' }))
    expect(await screen.findByText('Cat archived.')).toBeInTheDocument()
    expect(update).toHaveBeenCalledWith({ archived_at: expect.any(String) })
    expect(eq).toHaveBeenCalledWith('source_record_id', currentCat.source_record_id)
    expect(screen.queryByRole('button', { name: 'Archive Current Test Cat' })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Show archived records' }))
    single.mockResolvedValueOnce({ data: { source_record_id: currentCat.source_record_id, archived_at: null }, error: null })
    fireEvent.click(screen.getByRole('button', { name: 'Restore Current Test Cat' }))
    expect(await screen.findByText('Cat restored.')).toBeInTheDocument()
    expect(update).toHaveBeenLastCalledWith({ archived_at: null })
    fireEvent.click(screen.getByRole('button', { name: 'Show current records' }))
    expect(screen.getByRole('listitem')).toHaveTextContent('Adopted')
  })

  it.each(['database', 'network', 'missing record'])('preserves records and permits retry after archive %s failure', async type => {
    await renderRecords()
    if (type === 'network') single.mockRejectedValueOnce(new Error('Offline'))
    else single.mockResolvedValueOnce({ data: null, error: type === 'database' ? { message: 'Denied' } : null })
    fireEvent.click(screen.getByRole('button', { name: 'Archive Current Test Cat' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Could not update the archive state')
    expect(screen.getByRole('button', { name: 'Archive Current Test Cat' })).toBeEnabled()
    single.mockResolvedValueOnce({ data: { source_record_id: currentCat.source_record_id, archived_at: '2026-02-01T00:00:00Z' }, error: null })
    fireEvent.click(screen.getByRole('button', { name: 'Archive Current Test Cat' }))
    expect(await screen.findByText('Cat archived.')).toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('blocks overlapping actions while archiving', async () => {
    await renderRecords()
    let finish
    single.mockReturnValueOnce(new Promise(resolve => { finish = resolve }))
    fireEvent.click(screen.getByRole('button', { name: 'Archive Current Test Cat' }))
    expect(screen.getByRole('button', { name: 'Add cat' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Edit Current Test Cat' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Show archived records' })).toBeDisabled()
    fireEvent.click(screen.getByRole('button', { name: 'Archive Current Test Cat' }))
    expect(update).toHaveBeenCalledOnce()
    await act(async () => { finish({ data: { source_record_id: currentCat.source_record_id, archived_at: '2026-02-01T00:00:00Z' }, error: null }) })
    expect(screen.getByRole('button', { name: 'Add cat' })).toBeEnabled()
  })

  it('opens creation and adds the confirmed cat to the current list', async () => {
    await renderRecords()
    fireEvent.click(screen.getByRole('button', { name: 'Show archived records' }))
    fireEvent.click(screen.getByRole('button', { name: 'Add cat' }))
    expect(screen.getByRole('button', { name: 'Show current records' })).toBeDisabled()
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'New Test Cat' } })
    single.mockResolvedValueOnce({ data: { source_record_id: 'test-new', Name: 'New Test Cat', archived_at: null }, error: null })
    fireEvent.click(screen.getByRole('button', { name: 'Create cat' }))
    expect(await screen.findByText('Cat created.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Archive New Test Cat' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Show archived records' })).toBeInTheDocument()
    expect(screen.queryByLabelText('Name')).not.toBeInTheDocument()
  })

  it('shows loading while the request is pending', () => {
    select.mockReturnValue(new Promise(() => {}))
    render(<ShelterDashboard />)

    expect(screen.getByRole('status')).toHaveTextContent('Loading cats')
    expect(screen.queryByRole('list')).not.toBeInTheDocument()
    expect(screen.queryByText('No current cat records are available to your account.')).not.toBeInTheDocument()
  })

  it('displays returned records, including cats that share a name', async () => {
    // Synthetic fixtures, not real shelter records.
    select.mockResolvedValue({
      data: [
        { source_record_id: 'test-cat-1', Name: 'Test Cat', age_group: 'Young adult', availability_status: 'Available' },
        { source_record_id: 'test-cat-2', Name: 'Test Cat', age_group: 'Senior', availability_status: 'Pending' },
      ],
      error: null,
    })
    render(<ShelterDashboard />)

    const list = await screen.findByRole('list')
    const items = within(list).getAllByRole('listitem')
    expect(items).toHaveLength(2)
    expect(items[0]).toHaveTextContent('Test Cat — Young adult — Available')
    expect(items[1]).toHaveTextContent('Test Cat — Senior — Pending')
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
    expect(supabase.from).toHaveBeenCalledWith('Cat Profiles')
    expect(select).toHaveBeenCalledWith('source_record_id, Name, age_group, companionship_style, special_needs, availability_status, foster_id, archived_at')
  })

  it('keeps missing age and availability explicitly unknown', async () => {
    select.mockResolvedValue({
      data: [{ source_record_id: 'test-cat-1', Name: 'Test Cat', age_group: null, availability_status: null }],
      error: null,
    })
    render(<ShelterDashboard />)

    expect(await screen.findByRole('listitem')).toHaveTextContent(
      'Test Cat — Age unknown — Availability unknown'
    )
  })

  it.each([[], null])('shows an empty state for a successful response with data %j', async data => {
    select.mockResolvedValue({ data, error: null })
    render(<ShelterDashboard />)

    expect(await screen.findByText('No current cat records are available to your account.')).toBeInTheDocument()
    expect(screen.queryByRole('list')).not.toBeInTheDocument()
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('shows a safe error rather than an empty state for a database failure', async () => {
    select.mockResolvedValue({ data: null, error: { message: 'Internal database details' } })
    render(<ShelterDashboard />)

    expect(await screen.findByRole('alert')).toHaveTextContent('Could not load cats. Please try again.')
    expect(screen.queryByText('Internal database details')).not.toBeInTheDocument()
    expect(screen.queryByText('No current cat records are available to your account.')).not.toBeInTheDocument()
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })

  it('handles a rejected network request', async () => {
    select.mockRejectedValue(new Error('Offline'))
    render(<ShelterDashboard />)

    expect(await screen.findByRole('alert')).toHaveTextContent('Could not load cats. Please try again.')
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })
})
