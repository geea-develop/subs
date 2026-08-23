import { google } from 'googleapis'
import crypto from 'node:crypto'
import * as fs from 'node:fs/promises'
import * as path from 'node:path'

/**
 * Gmail OAuth + API Service
 * Read-only scope only — never request write/delete/send permissions
 */

const GMAIL_SCOPES = [
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/userinfo.email',
]

// Encryption settings for token storage
const ENCRYPTION_ALGORITHM = 'aes-256-gcm'
const IV_LENGTH = 16

const TOKEN_FILE = path.join(process.cwd(), '/data/gmail-tokens.json')

// --- Encryption helpers ---

function getEncryptionKey(): Buffer {
  if (process.env.TOKEN_ENCRYPTION_KEY) {
    const key = Buffer.from(process.env.TOKEN_ENCRYPTION_KEY, 'hex')
    if (key.length === 32) return key
  }
  return crypto
    .createHash('sha256')
    .update(process.env.GOOGLE_CLIENT_SECRET || 'default-key')
    .digest()
}

export function encryptToken(token: string): string {
  const key = getEncryptionKey()
  const iv = crypto.randomBytes(IV_LENGTH)
  const cipher = crypto.createCipheriv(ENCRYPTION_ALGORITHM, key, iv)

  let encrypted = cipher.update(token, 'utf8', 'hex')
  encrypted += cipher.final('hex')
  const authTag = cipher.getAuthTag()

  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`
}

export function decryptToken(encryptedToken: string): string {
  const key = getEncryptionKey()
  const parts = encryptedToken.split(':')

  if (parts.length !== 3) {
    throw new Error('Invalid encrypted token format')
  }

  const iv = Buffer.from(parts[0], 'hex')
  const authTag = Buffer.from(parts[1], 'hex')
  const encryptedData = parts[2]

  const decipher = crypto.createDecipheriv(ENCRYPTION_ALGORITHM, key, iv)
  decipher.setAuthTag(authTag)

  let decrypted = decipher.update(encryptedData, 'hex', 'utf8')
  decrypted += decipher.final('utf8')

  return decrypted
}

// --- Token storage (file-based, matches Subs pattern) ---

interface StoredTokens {
  accessToken: string // encrypted
  refreshToken: string // encrypted
  expiresAt: string
  email: string
}

export async function getStoredTokens(): Promise<StoredTokens | null> {
  try {
    const data = await fs.readFile(TOKEN_FILE, 'utf-8')
    return JSON.parse(data)
  } catch {
    return null
  }
}

export async function storeTokens(tokens: StoredTokens): Promise<void> {
  await fs.writeFile(TOKEN_FILE, JSON.stringify(tokens, null, 2), 'utf-8')
}

export async function deleteStoredTokens(): Promise<void> {
  try {
    await fs.unlink(TOKEN_FILE)
  } catch {
    // File doesn't exist, that's fine
  }
}

// --- OAuth2 client ---

function createOAuth2Client() {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI || 'http://localhost:3000/api/gmail/callback',
  )
}

export function generateAuthUrl(): string {
  const oauth2Client = createOAuth2Client()
  return oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: GMAIL_SCOPES,
    prompt: 'consent',
  })
}

export async function exchangeCodeForTokens(code: string) {
  const oauth2Client = createOAuth2Client()
  const { tokens } = await oauth2Client.getToken(code)
  return tokens
}

// --- Token management ---

async function getValidAccessToken(): Promise<string> {
  const stored = await getStoredTokens()
  if (!stored) {
    throw new Error('Gmail not connected')
  }

  const bufferMs = 5 * 60 * 1000 // 5 minute buffer
  const isExpired = new Date() > new Date(new Date(stored.expiresAt).getTime() - bufferMs)

  if (isExpired) {
    const oauth2Client = createOAuth2Client()
    const decryptedRefresh = decryptToken(stored.refreshToken)
    oauth2Client.setCredentials({ refresh_token: decryptedRefresh })

    const { credentials } = await oauth2Client.refreshAccessToken()

    // Update stored tokens
    await storeTokens({
      ...stored,
      accessToken: encryptToken(credentials.access_token!),
      expiresAt: new Date(credentials.expiry_date || Date.now() + 3600 * 1000).toISOString(),
    })

    return credentials.access_token!
  }

  return decryptToken(stored.accessToken)
}

// --- Gmail API operations ---

export async function getUserEmail(accessToken: string): Promise<string> {
  const oauth2Client = createOAuth2Client()
  oauth2Client.setCredentials({ access_token: accessToken })

  const gmail = google.gmail({ version: 'v1', auth: oauth2Client })
  const { data } = await gmail.users.getProfile({ userId: 'me' })
  return data.emailAddress || ''
}

export interface EmailMetadata {
  messageId: string
  threadId: string
  subject: string
  sender: string
  timestamp: string
  snippet: string
}

export async function searchEmails(
  query: string,
  maxResults = 30,
  pageToken?: string,
): Promise<{ emails: EmailMetadata[]; nextPageToken: string | null; totalEstimate: number }> {
  const accessToken = await getValidAccessToken()
  const oauth2Client = createOAuth2Client()
  oauth2Client.setCredentials({ access_token: accessToken })

  const gmail = google.gmail({ version: 'v1', auth: oauth2Client })

  const params: any = {
    userId: 'me',
    q: query,
    maxResults: Math.min(maxResults, 100),
  }
  if (pageToken) params.pageToken = pageToken

  const { data } = await gmail.users.messages.list(params)

  if (!data.messages || data.messages.length === 0) {
    return { emails: [], nextPageToken: null, totalEstimate: 0 }
  }

  // Fetch metadata for each message
  const emails = await Promise.all(
    data.messages.map(async (msg) => {
      try {
        const { data: msgData } = await gmail.users.messages.get({
          userId: 'me',
          id: msg.id!,
          format: 'metadata',
          metadataHeaders: ['Subject', 'From', 'Date'],
        })

        const headers = msgData.payload?.headers || []
        const getHeader = (name: string) => headers.find((h) => h.name === name)?.value || ''

        return {
          messageId: msgData.id!,
          threadId: msgData.threadId!,
          subject: getHeader('Subject'),
          sender: getHeader('From'),
          timestamp: getHeader('Date'),
          snippet: msgData.snippet || '',
        }
      } catch {
        return null
      }
    }),
  )

  return {
    emails: emails.filter((e): e is EmailMetadata => e !== null),
    nextPageToken: data.nextPageToken || null,
    totalEstimate: data.resultSizeEstimate || 0,
  }
}

// Subscription-related search query
const SUBSCRIPTION_KEYWORDS = [
  'invoice',
  'subscription',
  'renewal',
  'payment confirmation',
  'receipt',
  'billing statement',
  'your plan',
  'auto-renewal',
]

export function buildSubscriptionQuery(): string {
  return SUBSCRIPTION_KEYWORDS.map((k) => `(${k})`).join(' OR ')
}

export async function fetchSubscriptionEmails(maxResults = 30, pageToken?: string) {
  const query = buildSubscriptionQuery()
  return searchEmails(query, maxResults, pageToken)
}

export async function getConnectionStatus(): Promise<{ connected: boolean; email?: string }> {
  const tokens = await getStoredTokens()
  if (!tokens) return { connected: false }
  return { connected: true, email: tokens.email }
}
