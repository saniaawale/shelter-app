import { useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { CAT_IMAGE_BUCKET, IMAGE_EXTENSIONS, validateCatImage } from '../lib/fosterCats'

export default function CatImages({ catId, catName }) {
  const [images, setImages] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [revision, setRevision] = useState(0)
  const [file, setFile] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState('')
  const [notice, setNotice] = useState('')
  const fileInput = useRef(null)

  useEffect(() => {
    let cancelled = false
    const urls = []
    async function load() {
      setLoading(true)
      setLoadError('')
      try {
        const bucket = supabase.storage.from(CAT_IMAGE_BUCKET)
        const records = []
        for (let offset = 0; ; offset += 100) {
          const { data, error } = await bucket.list(catId, { limit: 100, offset, sortBy: { column: 'name', order: 'asc' } })
          if (error) throw error
          if (cancelled) return
          records.push(...(data ?? []).filter(item => item.id))
          if (!data || data.length < 100) break
        }
        const previews = []
        for (const record of records) {
          const { data, error } = await bucket.download(`${catId}/${record.name}`)
          if (error || !data) throw error || new Error('Image unavailable')
          if (cancelled) return
          const url = URL.createObjectURL(data)
          urls.push(url)
          previews.push({ id: record.id, url })
        }
        if (!cancelled) setImages(previews)
      } catch {
        if (!cancelled) {
          setImages([])
          setLoadError('Could not load images. Your cat assignment may have changed. Try again or contact shelter staff.')
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => {
      cancelled = true
      urls.forEach(url => URL.revokeObjectURL(url))
    }
  }, [catId, revision])

  async function upload(event) {
    event.preventDefault()
    if (uploading) return
    const validation = validateCatImage(file)
    if (validation) { setUploadError(validation); return }
    setUploading(true)
    setUploadError('')
    setNotice('')
    try {
      const path = `${catId}/${crypto.randomUUID()}.${IMAGE_EXTENSIONS[file.type]}`
      const { error } = await supabase.storage.from(CAT_IMAGE_BUCKET)
        .upload(path, file, { contentType: file.type, upsert: false })
      if (error) throw error
      setFile(null)
      if (fileInput.current) fileInput.current.value = ''
      setNotice('Image uploaded. It is saved privately for your assigned cat and shelter staff.')
      setRevision(current => current + 1)
    } catch {
      setUploadError('Could not upload the image. Your file is still selected; try again. Contact staff if your assignment has changed.')
    } finally {
      setUploading(false)
    }
  }

  return (
    <section className="foster-panel" aria-label={`Images for ${catName}`}>
      <h2>Images</h2>
      <p>JPEG, PNG, or WebP, up to 10 MB each. Images stay private.</p>
      {loading ? <p role="status">Loading images…</p> : loadError ? (
        <div><p role="alert">{loadError}</p><button type="button" onClick={() => setRevision(current => current + 1)}>Retry images</button></div>
      ) : images.length ? (
        <div className="cat-image-grid">{images.map((image, index) => (
          <img key={image.id} src={image.url} alt={`${catName}, photo ${index + 1}`} />
        ))}</div>
      ) : <p>No images added yet.</p>}
      <form onSubmit={upload} className="foster-form">
        <label>Add an image
          <input ref={fileInput} type="file" accept="image/jpeg,image/png,image/webp" disabled={uploading}
            onChange={event => { setFile(event.target.files?.[0] ?? null); setUploadError(''); setNotice('') }} />
        </label>
        <button className="primary-button" type="submit" disabled={uploading || !file}>{uploading ? 'Uploading…' : 'Upload image'}</button>
        {uploading && <p role="status">Uploading your image…</p>}
        {uploadError && <p role="alert">{uploadError}</p>}
        {notice && <p role="status">{notice}</p>}
      </form>
    </section>
  )
}
