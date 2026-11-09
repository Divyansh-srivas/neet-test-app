import { fetchAPI } from './apiClient'

const J = { 'Content-Type': 'application/json' }
async function call(path, opts) {
  const res = await fetchAPI(path, opts)
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    const err = new Error(data.error || `Request failed (${res.status})`)
    err.code = data.code; err.problems = data.problems; err.status = res.status
    throw err
  }
  return data
}
const body = (method, obj) => ({ method, headers: J, body: JSON.stringify(obj || {}) })

// student
export const listSeries = () => call('/api/test-series')
export const startSeries = (id) => call(`/api/test-series/${id}/start`, { method: 'POST' })
// admin
export const adminList = () => call('/api/admin/test-series')
export const adminCreate = (b) => call('/api/admin/test-series', body('POST', b))
export const adminUpdate = (id, b) => call(`/api/admin/test-series/${id}`, body('PUT', b))
export const adminDelete = (id) => call(`/api/admin/test-series/${id}`, { method: 'DELETE' })
export const adminSetSyllabus = (id, published) => call(`/api/admin/test-series/${id}/syllabus`, body('POST', { published }))
export const adminSetLive = (id, live) => call(`/api/admin/test-series/${id}/live`, body('POST', { live }))
export const adminQuestions = (id) => call(`/api/admin/test-series/${id}/questions`)
export const adminAddQuestion = (id, q) => call(`/api/admin/test-series/${id}/questions`, body('POST', q))
export const adminUpdateQuestion = (qid, q) => call(`/api/admin/test-series/questions/${qid}`, body('PUT', q))
export const adminDeleteQuestion = (qid) => call(`/api/admin/test-series/questions/${qid}`, { method: 'DELETE' })
export async function adminUploadImage(file) {
  const fd = new FormData()
  fd.append('image', file, file.name || 'image.png')
  return call('/api/admin/library/upload-image', { method: 'POST', body: fd })
}
