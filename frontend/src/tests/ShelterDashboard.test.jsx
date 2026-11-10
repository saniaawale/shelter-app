import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, within } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import ShelterDashboard from '../pages/ShelterDashboard'
import { supabase } from '../lib/supabase'

vi.mock('../lib/supabase', () => ({
  supabase: { from: vi.fn() },
}))

const select = vi.fn()

beforeEach(() => {
  vi.resetAllMocks()
  supabase.from.mockReturnValue({ select })
})

afterEach(cleanup)

describe('shelter cat records', () => {
  it('shows loading while the request is pending', () => {
    select.mockReturnValue(new Promise(() => {}))
    render(<ShelterDashboard />)

    expect(screen.getByRole('status')).toHaveTextContent('Loading cats')
    expect(screen.queryByRole('list')).not.toBeInTheDocument()
    expect(screen.queryByText('No cat records are available to your account.')).not.toBeInTheDocument()
  })

  it('displays returned records, including cats that share a name', async () => {
    // Synthetic fixtures, not real shelter records.
    select.mockResolvedValue({
      data: [
        { id: 'test-cat-1', Name: 'Test Cat', Age_group: 'Young adult', availability_status: 'Available' },
        { id: 'test-cat-2', Name: 'Test Cat', Age_group: 'Senior', availability_status: 'Pending' },
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
    expect(select).toHaveBeenCalledWith('id, Name, Age_group, personality, special_needs, availability_status, foster_id')
  })

  it('keeps missing age and availability explicitly unknown', async () => {
    select.mockResolvedValue({
      data: [{ id: 'test-cat-1', Name: 'Test Cat', Age_group: null, availability_status: null }],
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

    expect(await screen.findByText('No cat records are available to your account.')).toBeInTheDocument()
    expect(screen.queryByRole('list')).not.toBeInTheDocument()
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('shows a safe error rather than an empty state for a database failure', async () => {
    select.mockResolvedValue({ data: null, error: { message: 'Internal database details' } })
    render(<ShelterDashboard />)

    expect(await screen.findByRole('alert')).toHaveTextContent('Could not load cats. Please try again.')
    expect(screen.queryByText('Internal database details')).not.toBeInTheDocument()
    expect(screen.queryByText('No cat records are available to your account.')).not.toBeInTheDocument()
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })

  it('handles a rejected network request', async () => {
    select.mockRejectedValue(new Error('Offline'))
    render(<ShelterDashboard />)

    expect(await screen.findByRole('alert')).toHaveTextContent('Could not load cats. Please try again.')
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })
})
