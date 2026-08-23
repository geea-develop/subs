import type { ActionFunction, LoaderFunction } from '@remix-run/node'
import { json } from '@remix-run/node'
import { createSubscription, getAllSubscriptions, replaceAllSubscriptions } from '~/db'
import type { Subscription } from '~/store/subscriptionStore'

// GET /api/subscriptions — return all subscriptions
export const loader: LoaderFunction = async () => {
  const subscriptions = getAllSubscriptions()
  return json({ subscriptions })
}

// POST /api/subscriptions — create a new subscription or bulk replace
export const action: ActionFunction = async ({ request }) => {
  if (request.method === 'POST') {
    const body = await request.json()

    // Bulk replace: { action: "replace", subscriptions: [...] }
    if (body.action === 'replace') {
      const subs = body.subscriptions as Subscription[]
      replaceAllSubscriptions(subs)
      return json({ success: true, subscriptions: getAllSubscriptions() })
    }

    // Single create
    const subscription = createSubscription(body)
    return json({ subscription }, { status: 201 })
  }

  return json({ error: 'Method not allowed' }, { status: 405 })
}
