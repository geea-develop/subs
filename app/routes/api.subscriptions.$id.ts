import type { ActionFunction, LoaderFunction } from '@remix-run/node'
import { json } from '@remix-run/node'
import { deleteSubscription, getSubscription, updateSubscription } from '~/db'

// GET /api/subscriptions/:id
export const loader: LoaderFunction = async ({ params }) => {
  const { id } = params
  if (!id) return json({ error: 'Missing id' }, { status: 400 })

  const subscription = getSubscription(id)
  if (!subscription) return json({ error: 'Not found' }, { status: 404 })

  return json({ subscription })
}

// PUT /api/subscriptions/:id — update
// DELETE /api/subscriptions/:id — delete
export const action: ActionFunction = async ({ request, params }) => {
  const { id } = params
  if (!id) return json({ error: 'Missing id' }, { status: 400 })

  if (request.method === 'PUT') {
    const updates = await request.json()
    const subscription = updateSubscription(id, updates)
    if (!subscription) return json({ error: 'Not found' }, { status: 404 })
    return json({ subscription })
  }

  if (request.method === 'DELETE') {
    const deleted = deleteSubscription(id)
    if (!deleted) return json({ error: 'Not found' }, { status: 404 })
    return json({ success: true })
  }

  return json({ error: 'Method not allowed' }, { status: 405 })
}
