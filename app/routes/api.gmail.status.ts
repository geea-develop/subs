import type { LoaderFunction } from '@remix-run/node'
import { json } from '@remix-run/node'
import { getConnectionStatus } from '~/services/gmail.server'

/**
 * GET /api/gmail/status
 * Returns whether Gmail is connected and the associated email
 */
export const loader: LoaderFunction = async () => {
  const status = await getConnectionStatus()
  return json(status)
}
