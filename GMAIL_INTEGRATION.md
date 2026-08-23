# Gmail Email Import Integration

Scan your Gmail inbox for subscription receipts and payment confirmations, then import them directly into your dashboard.

## Features

- **Gmail OAuth2** (read-only) — never sends, modifies, or deletes emails
- **Smart parsing** — recognizes 60+ web/SaaS services (AWS, Vercel, GitHub, Figma, OpenAI, etc.)
- **Amount & currency extraction** — supports USD, EUR, GBP, INR, JPY
- **Billing cycle detection** — monthly, yearly, weekly, daily
- **Deduplication** — groups multiple emails from the same service, picks the highest-confidence match
- **Source tracking** — imported subscriptions are tagged with `source: "email"` and the original message ID
- **Encrypted token storage** — OAuth tokens are encrypted with AES-256-GCM at rest

## Setup

### 1. Create Google Cloud credentials

1. Go to [Google Cloud Console](https://console.cloud.google.com/apis/credentials)
2. Create a new project (or use an existing one)
3. Enable the **Gmail API**: [Enable here](https://console.cloud.google.com/apis/library/gmail.googleapis.com)
4. Create **OAuth 2.0 Client ID** (type: Web application)
5. Add authorized redirect URI: `http://localhost:3000/api/gmail/callback`

### 2. Configure environment variables

Copy `.env.example` to `.env` and fill in:

```env
GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-client-secret
GOOGLE_REDIRECT_URI=http://localhost:3000/api/gmail/callback
TOKEN_ENCRYPTION_KEY=<generate with: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))">
```

### 3. Run the app

```bash
npm run dev
# or
pnpm dev
```

Click the **Email** button in the action bar to connect Gmail and scan for subscriptions.

## How It Works

```
┌─────────────┐     ┌──────────────┐     ┌──────────────┐     ┌─────────────┐
│  Connect    │────▶│  Gmail API   │────▶│  Email       │────▶│  Import to  │
│  Gmail      │     │  Search      │     │  Parser      │     │  Dashboard  │
└─────────────┘     └──────────────┘     └──────────────┘     └─────────────┘
   OAuth2             Keyword search       Regex-based           User selects
   read-only          for receipts         extraction            candidates
```

1. **Connect** — OAuth2 flow with `gmail.readonly` scope
2. **Scan** — Searches for emails containing keywords like "invoice", "subscription", "payment confirmation", "receipt"
3. **Parse** — Extracts service name, amount, currency, billing cycle from email subject + snippet
4. **Review** — Shows candidates with confidence scores; highlights duplicates
5. **Import** — Selected subscriptions are added to the store with source metadata

## API Routes

| Route | Method | Description |
|-------|--------|-------------|
| `/api/gmail/connect` | GET | Redirects to Google OAuth consent |
| `/api/gmail/callback` | GET | Handles OAuth callback, stores tokens |
| `/api/gmail/disconnect` | POST | Removes stored tokens |
| `/api/gmail/status` | GET | Returns `{ connected, email }` |
| `/api/gmail/scan` | GET | Fetches + parses emails, returns candidates |

## File Structure

```
app/
├── services/
│   ├── gmail.server.ts        # OAuth, token management, Gmail API calls
│   └── emailParser.server.ts  # Rule-based email → subscription parsing
├── routes/
│   ├── api.gmail.connect.ts
│   ├── api.gmail.callback.ts
│   ├── api.gmail.disconnect.ts
│   ├── api.gmail.status.ts
│   └── api.gmail.scan.ts
└── components/
    └── EmailImportDialog.tsx   # UI for connect, scan, review, import
```

## Privacy & Security

- **Read-only access** — scope is limited to `gmail.readonly` + `userinfo.email`
- **No email content stored** — only metadata (subject, sender, snippet) is processed transiently
- **Encrypted tokens** — access and refresh tokens are encrypted with AES-256-GCM before writing to disk
- **Local storage** — tokens stored in `data/gmail-tokens.json` (gitignored)
- **User-initiated only** — scanning only happens when the user clicks "Scan Emails"

## Supported Services (partial list)

Streaming, Cloud/Infra, Developer Tools, AI Tools, Productivity, Domains/Hosting, VPN, Education — see `emailParser.server.ts` for the full list of 60+ recognized services.

## Future Ideas

- [ ] IMAP support (for non-Gmail providers)
- [ ] Scheduled periodic scanning
- [ ] LLM-based parsing for unknown services
- [ ] Receipt PDF attachment parsing
- [ ] Multi-user support
