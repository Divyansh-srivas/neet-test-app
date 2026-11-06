import { fetchAPI } from './apiClient'

const json = async (res) => { try { return await res.json() } catch { return {} } }

export async function getPlans() {
  const res = await fetchAPI('/api/billing/plans')
  if (!res.ok) throw new Error('Could not load plans')
  return json(res)
}

export async function getBillingStatus() {
  const res = await fetchAPI('/api/billing/status')
  if (!res.ok) throw new Error('status failed')
  return json(res)
}

export async function createOrder(planId) {
  const res = await fetchAPI('/api/billing/order', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ planId }),
  })
  const data = await json(res)
  if (!res.ok) throw new Error(data.error || 'Could not start the payment')
  return data
}

export async function verifyPayment(payload) {
  const res = await fetchAPI('/api/billing/verify', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
  })
  const data = await json(res)
  if (!res.ok) throw new Error(data.error || 'Verification failed')
  return data
}

let scriptPromise = null
export function loadRazorpay() {
  if (window.Razorpay) return Promise.resolve(true)
  if (!scriptPromise) {
    scriptPromise = new Promise((resolve) => {
      const s = document.createElement('script')
      s.src = 'https://checkout.razorpay.com/v1/checkout.js'
      s.onload = () => resolve(true)
      s.onerror = () => { scriptPromise = null; resolve(false) }
      document.body.appendChild(s)
    })
  }
  return scriptPromise
}
