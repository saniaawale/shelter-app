export const FOSTER_CAT_FIELDS = 'id, Name, Age_group, personality, bio, good_with_dogs, special_needs, instagram_handle, Paired, availability_status, archived_at, original_foster_description'
export const CAT_IMAGE_BUCKET = 'cat-images'
export const MAX_CAT_IMAGE_SIZE = 10 * 1024 * 1024
export const IMAGE_EXTENSIONS = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' }

export function validateCatImage(file) {
  if (!file || !IMAGE_EXTENSIONS[file.type]) return 'Choose a JPEG, PNG, or WebP image.'
  if (!file.size || file.size > MAX_CAT_IMAGE_SIZE) return 'Choose an image between 1 byte and 10 MB.'
  return ''
}
