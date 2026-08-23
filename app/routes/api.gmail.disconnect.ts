import type { ActionFunction, LoaderFunction } from '@remix-run/node'
import { json } from '@remix-run/node'
import { deleteStoredTokens } from '~/services/gmail.server'

/**
 * POST /api/gmail/disconnect
 * Removes stored Gmail tokens
 */
export const action: ActionFunction = async ({ request }) => {
  if (request.method !== 'POST') {
    return json({ error: 'Method not allowed' }, { status: 405 })
  }

  await deleteStoredTokens()
  return json({ success: true, message: 'Gmail disconnected' })
}

/**
 * GET /api/gmail/disconnect — also support GET for simplicity
 */
export const loader: LoaderFunction = async () => {
  await deleteStoredTokens()
  return json({ success: true, message: 'Gmail disconnected' })
}
