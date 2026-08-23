import type { EmailMetadata } from './gmail.server'

/**
 * Email Parser Service
 * Extracts subscription data from email metadata using rule-based parsing.
 * Optimized for web/SaaS products.
 */

// Known web/SaaS services and their patterns
const KNOWN_SERVICES = [
  // Streaming & Entertainment
  { pattern: /netflix/i, name: 'Netflix', category: 'Streaming' as const },
  { pattern: /spotify/i, name: 'Spotify', category: 'Music' as const },
  { pattern: /amazon\s*prime/i, name: 'Amazon Prime', category: 'Streaming' as const },
  { pattern: /disney\s*\+|disneyplus/i, name: 'Disney+', category: 'Streaming' as const },
  { pattern: /hbo\s*max|hbomax/i, name: 'HBO Max', category: 'Streaming' as const },
  { pattern: /youtube\s*(premium|music)/i, name: 'YouTube Premium', category: 'Streaming' as const },
  { pattern: /apple\s*(tv|music|one|arcade)/i, name: 'Apple', category: 'Streaming' as const },
  { pattern: /hulu/i, name: 'Hulu', category: 'Streaming' as const },

  // Cloud & Infrastructure
  { pattern: /aws|amazon\s*web\s*services/i, name: 'AWS', category: 'Cloud' as const },
  { pattern: /google\s*cloud|gcp/i, name: 'Google Cloud', category: 'Cloud' as const },
  { pattern: /azure|microsoft\s*azure/i, name: 'Azure', category: 'Cloud' as const },
  { pattern: /vercel/i, name: 'Vercel', category: 'Cloud' as const },
  { pattern: /netlify/i, name: 'Netlify', category: 'Cloud' as const },
  { pattern: /heroku/i, name: 'Heroku', category: 'Cloud' as const },
  { pattern: /digital\s*ocean/i, name: 'DigitalOcean', category: 'Cloud' as const },
  { pattern: /cloudflare/i, name: 'Cloudflare', category: 'Cloud' as const },
  { pattern: /supabase/i, name: 'Supabase', category: 'Cloud' as const },
  { pattern: /planetscale/i, name: 'PlanetScale', category: 'Cloud' as const },
  { pattern: /railway/i, name: 'Railway', category: 'Cloud' as const },
  { pattern: /render\.com|render/i, name: 'Render', category: 'Cloud' as const },

  // Developer Tools
  { pattern: /github/i, name: 'GitHub', category: 'Developer Tools' as const },
  { pattern: /gitlab/i, name: 'GitLab', category: 'Developer Tools' as const },
  { pattern: /jetbrains|intellij|webstorm|pycharm/i, name: 'JetBrains', category: 'Developer Tools' as const },
  { pattern: /docker/i, name: 'Docker', category: 'Developer Tools' as const },
  { pattern: /sentry/i, name: 'Sentry', category: 'Developer Tools' as const },
  { pattern: /datadog/i, name: 'Datadog', category: 'Developer Tools' as const },
  { pattern: /postman/i, name: 'Postman', category: 'Developer Tools' as const },
  { pattern: /ngrok/i, name: 'ngrok', category: 'Developer Tools' as const },

  // AI Tools
  { pattern: /openai|chatgpt/i, name: 'OpenAI', category: 'AI Tools' as const },
  { pattern: /anthropic|claude/i, name: 'Anthropic', category: 'AI Tools' as const },
  { pattern: /midjourney/i, name: 'Midjourney', category: 'AI Tools' as const },
  { pattern: /cursor/i, name: 'Cursor', category: 'AI Tools' as const },
  { pattern: /copilot/i, name: 'GitHub Copilot', category: 'AI Tools' as const },
  { pattern: /replicate/i, name: 'Replicate', category: 'AI Tools' as const },

  // Productivity
  { pattern: /notion/i, name: 'Notion', category: 'Productivity' as const },
  { pattern: /slack/i, name: 'Slack', category: 'Productivity' as const },
  { pattern: /figma/i, name: 'Figma', category: 'Productivity' as const },
  { pattern: /canva/i, name: 'Canva', category: 'Productivity' as const },
  { pattern: /adobe/i, name: 'Adobe Creative Cloud', category: 'Productivity' as const },
  { pattern: /microsoft\s*365|office\s*365/i, name: 'Microsoft 365', category: 'Productivity' as const },
  { pattern: /google\s*(one|workspace)/i, name: 'Google Workspace', category: 'Productivity' as const },
  { pattern: /dropbox/i, name: 'Dropbox', category: 'Cloud' as const },
  { pattern: /zoom/i, name: 'Zoom', category: 'Productivity' as const },
  { pattern: /linear/i, name: 'Linear', category: 'Productivity' as const },
  { pattern: /1password|onepassword/i, name: '1Password', category: 'Productivity' as const },
  { pattern: /grammarly/i, name: 'Grammarly', category: 'Productivity' as const },
  { pattern: /todoist/i, name: 'Todoist', category: 'Productivity' as const },

  // Domains & Hosting
  { pattern: /namecheap/i, name: 'Namecheap', category: 'Cloud' as const },
  { pattern: /godaddy/i, name: 'GoDaddy', category: 'Cloud' as const },
  { pattern: /squarespace/i, name: 'Squarespace', category: 'Cloud' as const },
  { pattern: /wordpress|automattic/i, name: 'WordPress', category: 'Cloud' as const },
  { pattern: /wix/i, name: 'Wix', category: 'Cloud' as const },
  { pattern: /shopify/i, name: 'Shopify', category: 'Cloud' as const },

  // VPN & Security
  { pattern: /nordvpn/i, name: 'NordVPN', category: 'Other' as const },
  { pattern: /expressvpn/i, name: 'ExpressVPN', category: 'Other' as const },
  { pattern: /surfshark/i, name: 'Surfshark', category: 'Other' as const },

  // Education
  { pattern: /udemy/i, name: 'Udemy', category: 'Education' as const },
  { pattern: /coursera/i, name: 'Coursera', category: 'Education' as const },
  { pattern: /pluralsight/i, name: 'Pluralsight', category: 'Education' as const },
  { pattern: /skillshare/i, name: 'Skillshare', category: 'Education' as const },
  { pattern: /linkedin\s*learning/i, name: 'LinkedIn Learning', category: 'Education' as const },
] as const

// Billing cycle patterns
const BILLING_PATTERNS = {
  monthly: /monthly|per\s*month|\/month|\/mo|each\s*month/i,
  yearly: /yearly|annual|per\s*year|\/year|\/yr|each\s*year/i,
  weekly: /weekly|per\s*week|\/week|each\s*week/i,
  daily: /daily|per\s*day|\/day/i,
} as const

// Amount extraction patterns (multi-currency)
const AMOUNT_PATTERNS = [
  { regex: /\$\s*(\d+(?:[.,]\d{1,2})?)/, currency: 'USD' },
  { regex: /(\d+(?:[.,]\d{1,2})?)\s*(?:USD|dollars?)/i, currency: 'USD' },
  { regex: /€\s*(\d+(?:[.,]\d{1,2})?)/, currency: 'EUR' },
  { regex: /(\d+(?:[.,]\d{1,2})?)\s*(?:EUR|euros?)/i, currency: 'EUR' },
  { regex: /£\s*(\d+(?:[.,]\d{1,2})?)/, currency: 'GBP' },
  { regex: /(\d+(?:[.,]\d{1,2})?)\s*(?:GBP|pounds?)/i, currency: 'GBP' },
  { regex: /₹\s*(\d+(?:[.,]\d{1,2})?)/, currency: 'INR' },
  { regex: /(\d+(?:[.,]\d{1,2})?)\s*(?:INR|rupees?)/i, currency: 'INR' },
  { regex: /¥\s*(\d+(?:[.,]\d{1,2})?)/, currency: 'JPY' },
] as const

export type BillingCycle = 'monthly' | 'yearly' | 'weekly' | 'daily'

export interface ParsedSubscription {
  serviceName: string | null
  category: string | null
  billingCycle: BillingCycle | null
  amount: number | null
  currency: string | null
  domain: string | null
  confidence: number
  sourceEmail: {
    messageId: string
    subject: string
    sender: string
    date: string
  }
}

function extractServiceName(sender: string, subject: string): { name: string; category: string } | null {
  const combined = `${sender} ${subject}`

  for (const service of KNOWN_SERVICES) {
    if (service.pattern.test(combined)) {
      return { name: service.name, category: service.category }
    }
  }

  // Extract from email domain as fallback
  const emailMatch = sender.match(/@([a-z0-9-]+)\./i)
  if (emailMatch) {
    const domain = emailMatch[1]
    // Skip generic senders
    if (!['noreply', 'no-reply', 'mail', 'email', 'info', 'support', 'billing'].includes(domain)) {
      return { name: domain.charAt(0).toUpperCase() + domain.slice(1), category: 'Other' }
    }
  }

  // Extract from sender display name
  const nameMatch = sender.match(/^([^<]+)/)
  if (nameMatch) {
    const name = nameMatch[1].trim()
    if (name && name.length < 40) {
      return { name, category: 'Other' }
    }
  }

  return null
}

function extractDomain(sender: string): string | null {
  const match = sender.match(/@([a-z0-9.-]+\.[a-z]{2,})/i)
  if (match) {
    return `https://${match[1]}`
  }
  return null
}

function detectBillingCycle(text: string): BillingCycle | null {
  for (const [cycle, pattern] of Object.entries(BILLING_PATTERNS)) {
    if (pattern.test(text)) {
      return cycle as BillingCycle
    }
  }
  return null
}

function extractAmount(text: string): { amount: number; currency: string } | null {
  for (const { regex, currency } of AMOUNT_PATTERNS) {
    const match = text.match(regex)
    if (match) {
      const amountStr = match[1].replace(',', '.')
      const amount = Number.parseFloat(amountStr)
      if (!Number.isNaN(amount) && amount > 0 && amount < 10000) {
        return { amount, currency }
      }
    }
  }
  return null
}

function calculateConfidence(parsed: {
  serviceName: string | null
  billingCycle: BillingCycle | null
  amount: number | null
}): number {
  let score = 0
  if (parsed.serviceName) score += 40
  if (parsed.billingCycle) score += 30
  if (parsed.amount) score += 30
  return score
}

export function parseEmail(email: EmailMetadata): ParsedSubscription {
  const combinedText = `${email.subject} ${email.snippet}`

  const serviceInfo = extractServiceName(email.sender, email.subject)
  const billingCycle = detectBillingCycle(combinedText)
  const amountData = extractAmount(combinedText)
  const domain = extractDomain(email.sender)

  const serviceName = serviceInfo?.name || null
  const category = serviceInfo?.category || null
  const amount = amountData?.amount || null
  const currency = amountData?.currency || null

  return {
    serviceName,
    category,
    billingCycle,
    amount,
    currency,
    domain,
    confidence: calculateConfidence({ serviceName, billingCycle, amount }),
    sourceEmail: {
      messageId: email.messageId,
      subject: email.subject,
      sender: email.sender,
      date: email.timestamp,
    },
  }
}

export function parseEmails(emails: EmailMetadata[]): ParsedSubscription[] {
  return emails.map(parseEmail)
}

/**
 * Parse emails and deduplicate by service name.
 * Returns the highest-confidence entry per service.
 */
export function parseAndDeduplicate(emails: EmailMetadata[]): ParsedSubscription[] {
  const parsed = parseEmails(emails)
  const grouped = new Map<string, ParsedSubscription>()

  for (const entry of parsed) {
    const key = entry.serviceName?.toLowerCase() || entry.sourceEmail.messageId
    const existing = grouped.get(key)

    if (!existing || entry.confidence > existing.confidence) {
      grouped.set(key, entry)
    }
  }

  return Array.from(grouped.values())
    .filter((p) => p.confidence >= 40) // At least service name detected
    .sort((a, b) => b.confidence - a.confidence)
}
