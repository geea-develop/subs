import { useCallback, useEffect, useState } from 'react'
import { Check, Loader2, Mail, MailX, RefreshCw, Unlink } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '~/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '~/components/ui/dialog'
import { Checkbox } from '~/components/ui/checkbox'
import { Badge } from '~/components/ui/badge'
import { ScrollArea } from '~/components/ui/scroll-area'
import useSubscriptionStore from '~/store/subscriptionStore'
import type { Subscription } from '~/store/subscriptionStore'

interface ParsedCandidate {
  serviceName: string | null
  category: string | null
  billingCycle: string | null
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

interface ScanResult {
  candidates: ParsedCandidate[]
  emailsScanned: number
  candidatesFound: number
  nextPageToken: string | null
}

export function EmailImportDialog() {
  const [open, setOpen] = useState(false)
  const [status, setStatus] = useState<{ connected: boolean; email?: string } | null>(null)
  const [scanning, setScanning] = useState(false)
  const [candidates, setCandidates] = useState<ParsedCandidate[]>([])
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [scanResult, setScanResult] = useState<ScanResult | null>(null)
  const [loading, setLoading] = useState(true)

  const { addSubscription, subscriptions } = useSubscriptionStore()

  // Check connection status when dialog opens
  useEffect(() => {
    if (open) {
      checkStatus()
    }
  }, [open])

  const checkStatus = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/gmail/status')
      const data = await res.json()
      setStatus(data)
    } catch {
      setStatus({ connected: false })
    }
    setLoading(false)
  }

  const handleConnect = () => {
    // Redirect to OAuth flow
    window.location.href = '/api/gmail/connect'
  }

  const handleDisconnect = async () => {
    await fetch('/api/gmail/disconnect', { method: 'POST' })
    setStatus({ connected: false })
    setCandidates([])
    setSelected(new Set())
    setScanResult(null)
    toast.success('Gmail disconnected')
  }

  const handleScan = useCallback(async () => {
    setScanning(true)
    setCandidates([])
    setSelected(new Set())
    setScanResult(null)

    try {
      const res = await fetch('/api/gmail/scan')
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Scan failed')
      }

      const data: ScanResult = await res.json()
      setCandidates(data.candidates)
      setScanResult(data)

      // Pre-select all candidates that aren't already subscribed
      const existingNames = new Set(subscriptions.map((s) => s.name.toLowerCase()))
      const preSelected = new Set<number>()
      data.candidates.forEach((c, i) => {
        if (c.serviceName && !existingNames.has(c.serviceName.toLowerCase())) {
          preSelected.add(i)
        }
      })
      setSelected(preSelected)

      if (data.candidates.length === 0) {
        toast.info('No subscription emails found')
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Scan failed'
      toast.error(message)
    }

    setScanning(false)
  }, [subscriptions])

  const toggleSelect = (index: number) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(index)) {
        next.delete(index)
      } else {
        next.add(index)
      }
      return next
    })
  }

  const toggleAll = () => {
    if (selected.size === candidates.length) {
      setSelected(new Set())
    } else {
      setSelected(new Set(candidates.map((_, i) => i)))
    }
  }

  const handleImport = () => {
    let imported = 0
    const existingNames = new Set(subscriptions.map((s) => s.name.toLowerCase()))

    for (const idx of selected) {
      const candidate = candidates[idx]
      if (!candidate.serviceName) continue

      // Skip duplicates
      if (existingNames.has(candidate.serviceName.toLowerCase())) continue

      const sub: Omit<Subscription, 'id'> = {
        name: candidate.serviceName,
        price: candidate.amount || 0,
        currency: candidate.currency || 'USD',
        domain: candidate.domain || '',
        billingCycle: (candidate.billingCycle as Subscription['billingCycle']) || 'monthly',
        category: (candidate.category as Subscription['category']) || undefined,
        source: 'email',
        sourceEmailId: candidate.sourceEmail.messageId,
        importedAt: new Date().toISOString(),
      }

      addSubscription(sub)
      existingNames.add(candidate.serviceName.toLowerCase())
      imported++
    }

    toast.success(`Imported ${imported} subscription${imported === 1 ? '' : 's'} from email`)
    setOpen(false)
  }

  const confidenceBadge = (confidence: number) => {
    if (confidence >= 70) return <Badge variant="default" className="bg-green-600 text-xs">High</Badge>
    if (confidence >= 40) return <Badge variant="secondary" className="text-xs">Medium</Badge>
    return <Badge variant="outline" className="text-xs">Low</Badge>
  }

  const existingNames = new Set(subscriptions.map((s) => s.name.toLowerCase()))

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" className="rounded-none">
          <Mail className="mr-1 h-3 w-3" />
          Email
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle>Import from Email</DialogTitle>
          <DialogDescription>
            Scan your Gmail for subscription receipts and payment confirmations.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : !status?.connected ? (
          <div className="flex flex-col items-center gap-4 py-8">
            <MailX className="h-12 w-12 text-muted-foreground" />
            <p className="text-sm text-muted-foreground text-center">
              Connect your Gmail to scan for subscription emails.
              <br />
              <span className="text-xs">Read-only access — we never send, modify, or delete emails.</span>
            </p>
            <Button onClick={handleConnect}>
              <Mail className="mr-2 h-4 w-4" />
              Connect Gmail
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Connection info */}
            <div className="flex items-center justify-between rounded-md border p-3">
              <div className="flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-green-500" />
                <span className="text-sm">{status.email}</span>
              </div>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={handleScan} disabled={scanning}>
                  {scanning ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <RefreshCw className="mr-1 h-3 w-3" />}
                  {scanning ? 'Scanning...' : 'Scan Emails'}
                </Button>
                <Button size="sm" variant="ghost" onClick={handleDisconnect}>
                  <Unlink className="h-3 w-3" />
                </Button>
              </div>
            </div>

            {/* Scan results */}
            {scanResult && (
              <div className="text-xs text-muted-foreground">
                Scanned {scanResult.emailsScanned} emails · Found {scanResult.candidatesFound} subscriptions
              </div>
            )}

            {/* Candidate list */}
            {candidates.length > 0 && (
              <>
                <div className="flex items-center justify-between">
                  <Button size="sm" variant="ghost" onClick={toggleAll} className="text-xs">
                    {selected.size === candidates.length ? 'Deselect all' : 'Select all'}
                  </Button>
                  <span className="text-xs text-muted-foreground">{selected.size} selected</span>
                </div>
                <ScrollArea className="h-[300px] rounded-md border">
                  <div className="space-y-1 p-2">
                    {candidates.map((candidate, idx) => {
                      const isDuplicate = candidate.serviceName
                        ? existingNames.has(candidate.serviceName.toLowerCase())
                        : false

                      return (
                        <div
                          key={candidate.sourceEmail.messageId}
                          className={`flex items-center gap-3 rounded-md p-2 hover:bg-muted/50 ${
                            isDuplicate ? 'opacity-50' : ''
                          }`}
                        >
                          <Checkbox
                            checked={selected.has(idx)}
                            onCheckedChange={() => toggleSelect(idx)}
                            disabled={isDuplicate}
                          />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-sm truncate">
                                {candidate.serviceName || 'Unknown'}
                              </span>
                              {isDuplicate && (
                                <Badge variant="outline" className="text-xs shrink-0">
                                  Already added
                                </Badge>
                              )}
                              {confidenceBadge(candidate.confidence)}
                            </div>
                            <div className="text-xs text-muted-foreground truncate">
                              {candidate.sourceEmail.subject}
                            </div>
                          </div>
                          <div className="text-right shrink-0">
                            {candidate.amount ? (
                              <span className="text-sm font-medium">
                                {candidate.currency === 'USD' && '$'}
                                {candidate.currency === 'EUR' && '€'}
                                {candidate.currency === 'GBP' && '£'}
                                {candidate.amount.toFixed(2)}
                                <span className="text-xs text-muted-foreground ml-1">
                                  /{candidate.billingCycle?.replace('ly', '') || 'mo'}
                                </span>
                              </span>
                            ) : (
                              <span className="text-xs text-muted-foreground">No price</span>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </ScrollArea>
              </>
            )}
          </div>
        )}

        {candidates.length > 0 && selected.size > 0 && (
          <DialogFooter>
            <Button onClick={handleImport}>
              <Check className="mr-1 h-4 w-4" />
              Import {selected.size} Subscription{selected.size === 1 ? '' : 's'}
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  )
}
