import type { LoaderFunction } from '@remix-run/node'
import { redirect } from '@remix-run/node'
import { encryptToken, exchangeCodeForTokens, getUserEmail, storeTokens } from '~/services/gmail.server'

/**
 * GET /api/gmail/callback
 * Handles OAuth2 callback from Google, stores encrypted tokens
 */
export const loader: LoaderFunction = async ({ request }) => {
  const url = new URL(request.url)
  const code = url.searchParams.get('code')
  const error = url.searchParams.get('error')

  if (error) {
    console.error('[Gmail] OAuth error:', error)
    return redirect('/?gmail=error')
  }

  if (!code) {
    return redirect('/?gmail=error')
  }

  try {
    const tokens = await exchangeCodeForTokens(code)

    if (!tokens.access_token || !tokens.refresh_token) {
      console.error('[Gmail] Missing tokens in response')
      return redirect('/?gmail=error')
    }

    // Get the user's email address
    const email = await getUserEmail(tokens.access_token)

    // Store encrypted tokens
    await storeTokens({
      accessToken: encryptToken(tokens.access_token),
      refreshToken: encryptToken(tokens.refresh_token),
      expiresAt: new Date(tokens.expiry_date || Date.now() + 3600 * 1000).toISOString(),
      email,
    })

    return redirect('/?gmail=connected')
  } catch (err) {
    console.error('[Gmail] Token exchange failed:', err)
    return redirect('/?gmail=error')
  }
}
