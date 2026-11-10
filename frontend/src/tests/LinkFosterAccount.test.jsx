import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import LinkFosterAccount from '../components/LinkFosterAccount'
import { supabase } from '../lib/supabase'

vi.mock('../lib/supabase', () => ({ supabase: { rpc: vi.fn() } }))
beforeEach(() => {
  vi.clearAllMocks()
  supabase.rpc.mockResolvedValue({ data: [{ foster_id: 'test-foster', Name: 'Test Foster' }], error: null })
})
afterEach(cleanup)
function renderForm() {
  render(<LinkFosterAccount />)
  fireEvent.click(screen.getByText('Link a foster account'))
  fireEvent.change(screen.getByLabelText('Foster name'), { target: { value: ' Test Foster ' } })
  fireEvent.change(screen.getByLabelText('Foster account email'), { target: { value: 'test@example.com' } })
}
describe('staff foster account linking', () => {
  it('links an existing account through the guarded RPC without sending an invitation', async () => {
    renderForm()
    fireEvent.click(screen.getByRole('button', { name: 'Link account' }))
    expect(await screen.findByRole('status')).toHaveTextContent('Foster account linked')
    expect(supabase.rpc).toHaveBeenCalledExactlyOnceWith('link_foster_account', {
      account_email: 'test@example.com', foster_name: 'Test Foster',
    })
    expect(screen.getByLabelText('Foster account email')).toHaveValue('')
  })
  it('preserves entries if the account cannot be linked', async () => {
    supabase.rpc.mockResolvedValueOnce({ data: null, error: { message: 'Not eligible' } })
    renderForm()
    fireEvent.click(screen.getByRole('button', { name: 'Link account' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('existing Supabase Auth account with the foster role')
    expect(screen.getByLabelText('Foster account email')).toHaveValue('test@example.com')
    await waitFor(() => expect(screen.getByRole('button', { name: 'Link account' })).toBeEnabled())
  })
})
