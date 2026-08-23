import type { LoaderFunction } from '@remix-run/node'
import { json } from '@remix-run/node'
import { parseAndDeduplicate } from '~/services/emailParser.server'
import { fetchSubscriptionEmails, getConnectionStatus } from '~/services/gmail.server'

/**
 * GET /api/gmail/scan
 * Fetches subscription-related emails and parses them into candidates.
 * Query params:
 *   - maxResults (default 30)
 *   - pageToken (for pagination)
 */
export const loader: LoaderFunction = async ({ request }) => {
  const status = await getConnectionStatus()
  if (!status.connected) {
    return json({ error: 'Gmail not connected' }, { status: 401 })
  }

  const url = new URL(request.url)
  const maxResults = Number.parseInt(url.searchParams.get('maxResults') || '30', 10)
  const pageToken = url.searchParams.get('pageToken') || undefined

  try {
    const { emails, nextPageToken, totalEstimate } = await fetchSubscriptionEmails(maxResults, pageToken)

    // Parse and deduplicate
    const candidates = parseAndDeduplicate(emails)

    return json({
      candidates,
      nextPageToken,
      totalEstimate,
      emailsScanned: emails.length,
      candidatesFound: candidates.length,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error('[Gmail] Scan failed:', message)

    if (message.includes('Gmail not connected') || message.includes('invalid')) {
      return json({ error: 'Gmail connection expired. Please reconnect.' }, { status: 401 })
    }

    return json({ error: `Scan failed: ${message}` }, { status: 500 })
  }
}
