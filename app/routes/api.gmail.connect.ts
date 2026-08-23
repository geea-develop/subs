import type { LoaderFunction } from '@remix-run/node'
import { redirect } from '@remix-run/node'
import { generateAuthUrl } from '~/services/gmail.server'

/**
 * GET /api/gmail/connect
 * Redirects user to Google OAuth consent screen
 */
export const loader: LoaderFunction = async () => {
  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
    throw new Response('Gmail integration not configured. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET.', {
      status: 503,
    })
  }

  const authUrl = generateAuthUrl()
  return redirect(authUrl)
}
