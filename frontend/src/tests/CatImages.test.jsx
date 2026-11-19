import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import CatImages from '../components/CatImages'
import { supabase } from '../lib/supabase'
import { MAX_CAT_IMAGE_SIZE } from '../lib/fosterCats'

vi.mock('../lib/supabase', () => ({ supabase: { storage: { from: vi.fn() } } }))
const list = vi.fn()
const download = vi.fn()
const upload = vi.fn()
beforeEach(() => {
  vi.clearAllMocks()
  list.mockResolvedValue({ data: [], error: null })
  download.mockResolvedValue({ data: new Blob(['test image'], { type: 'image/png' }), error: null })
  upload.mockResolvedValue({ data: { path: 'test-cat/test.png' }, error: null })
  supabase.storage.from.mockReturnValue({ list, download, upload })
  vi.stubGlobal('URL', class extends URL {
    static createObjectURL = vi.fn(() => 'blob:test-photo')
    static revokeObjectURL = vi.fn()
  })
})
afterEach(() => { cleanup(); vi.unstubAllGlobals() })

function renderImages() { return render(<CatImages catId="test-cat" catName="Test Cat" />) }
function choose(file = new File(['synthetic image'], 'test.png', { type: 'image/png' })) {
  fireEvent.change(screen.getByLabelText('Add an image'), { target: { files: [file] } })
}
function submit() { fireEvent.click(screen.getByRole('button', { name: 'Upload image' })) }

describe('private cat images', () => {
  // Checks the gallery lists the selected cat folder in the cat-images bucket and explains when it is empty.
  it('loads only the selected cat folder and shows an empty state', async () => {
    renderImages()
    expect(await screen.findByText('No images added yet.')).toBeInTheDocument()
    expect(supabase.storage.from).toHaveBeenCalledWith('cat-images')
    expect(list).toHaveBeenCalledWith('test-cat', expect.objectContaining({ limit: 100, offset: 0 }))
  })

  // Checks a private image is downloaded for preview and its temporary browser URL is released on unmount.
  it('downloads private previews and releases object URLs when unmounted', async () => {
    list.mockResolvedValueOnce({ data: [{ id: 'test-photo', name: 'photo.png' }], error: null })
    const { unmount } = renderImages()
    expect(await screen.findByRole('img', { name: 'Test Cat, photo 1' })).toHaveAttribute('src', 'blob:test-photo')
    expect(download).toHaveBeenCalledWith('test-cat/photo.png')
    unmount()
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:test-photo')
  })

  // Returns a full first page to check the gallery requests the next page instead of stopping at 100 files.
  it('loads additional pages instead of silently truncating the gallery', async () => {
    list.mockResolvedValueOnce({ data: Array.from({ length: 100 }, (_, index) => ({ id: `photo-${index}`, name: `${index}.png` })), error: null })
    renderImages()
    await waitFor(() => expect(screen.getAllByRole('img', { name: /^Test Cat, photo \d+$/ })).toHaveLength(100))
    expect(list).toHaveBeenNthCalledWith(2, 'test-cat', expect.objectContaining({ offset: 100 }))
  })

  // Checks upload uses a generated filename inside the cat folder, avoids overwrites, and reloads the gallery.
  it('uploads under a generated cat-specific path and refreshes previews', async () => {
    renderImages()
    await screen.findByText('No images added yet.')
    choose(); submit()
    expect(await screen.findByText(/Image uploaded/)).toBeInTheDocument()
    expect(upload).toHaveBeenCalledWith(expect.stringMatching(/^test-cat\/[a-f0-9-]+\.png$/), expect.any(File), {
      contentType: 'image/png', upsert: false,
    })
    expect(list).toHaveBeenCalledTimes(2)
    expect(screen.getByRole('button', { name: 'Upload image' })).toBeDisabled()
  })

  // Runs SVG and plain-text file cases to check unsupported types are rejected before any upload request.
  it.each(['image/svg+xml', 'text/plain'])('rejects unsupported %s files before contacting Storage', async type => {
    renderImages()
    await screen.findByText('No images added yet.')
    choose(new File(['test'], 'test.file', { type })); submit()
    expect(screen.getByRole('alert')).toHaveTextContent('Choose a JPEG, PNG, or WebP')
    expect(upload).not.toHaveBeenCalled()
  })

  // Checks a file larger than 10 MB shows a size error and is not uploaded.
  it('rejects oversized images', async () => {
    renderImages()
    await screen.findByText('No images added yet.')
    const file = new File(['test'], 'test.png', { type: 'image/png' })
    Object.defineProperty(file, 'size', { value: MAX_CAT_IMAGE_SIZE + 1 })
    choose(file); submit()
    expect(screen.getByRole('alert')).toHaveTextContent('10 MB')
    expect(upload).not.toHaveBeenCalled()
  })

  // Checks a denied upload keeps the selected file and a second attempt can succeed.
  it('preserves file selection after denied upload and allows retry', async () => {
    upload.mockResolvedValueOnce({ data: null, error: { message: 'Denied' } })
    renderImages()
    await screen.findByText('No images added yet.')
    choose(); submit()
    expect(await screen.findByRole('alert')).toHaveTextContent('Your file is still selected')
    expect(screen.getByRole('button', { name: 'Upload image' })).toBeEnabled()
    submit()
    expect(await screen.findByText(/Image uploaded/)).toBeInTheDocument()
    expect(upload).toHaveBeenCalledTimes(2)
  })

  // Holds an upload pending to check repeated clicks cannot send duplicate upload requests.
  it('blocks duplicate uploads while a request is pending', async () => {
    let finish
    upload.mockReturnValueOnce(new Promise(resolve => { finish = resolve }))
    renderImages()
    await screen.findByText('No images added yet.')
    choose(); submit()
    const button = screen.getByRole('button', { name: 'Uploading…' })
    expect(button).toBeDisabled()
    fireEvent.click(button)
    expect(upload).toHaveBeenCalledOnce()
    await act(async () => { finish({ data: {}, error: null }) })
    expect(screen.getByText(/Image uploaded/)).toBeInTheDocument()
  })

  // Checks a failed image-list request can be retried while the file picker remains usable.
  it('recovers from a gallery failure without disabling uploads', async () => {
    list.mockRejectedValueOnce(new Error('Offline'))
    renderImages()
    expect(await screen.findByRole('alert')).toHaveTextContent('Could not load images')
    fireEvent.click(screen.getByRole('button', { name: 'Retry images' }))
    expect(await screen.findByText('No images added yet.')).toBeInTheDocument()
    expect(screen.getByLabelText('Add an image')).toBeEnabled()
  })
})
