import { Bell } from 'lucide-react'
import { Alert, AlertDescription, AlertTitle } from '~/components/ui/alert'
import type { UpcomingReminder } from '~/utils/notifications'

interface InAppRemindersProps {
  reminders: UpcomingReminder[]
}

function formatAmount(price: number, currency: string): string {
  try {
    return new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(price)
  } catch {
    return `${currency} ${price.toFixed(2)}`
  }
}

function formatDays(days: number): string {
  if (days === 0) return 'today'
  if (days === 1) return 'tomorrow'
  return `in ${days} days`
}

export function InAppReminders({ reminders }: InAppRemindersProps) {
  if (reminders.length === 0) return null

  return (
    <Alert className="mb-4" variant="default">
      <Bell className="h-4 w-4" />
      <AlertTitle>Upcoming payments</AlertTitle>
      <AlertDescription>
        <ul className="mt-1 space-y-0.5">
          {reminders.slice(0, 5).map((r) => (
            <li key={r.subscription.id} className="text-sm">
              <span className="font-medium">{r.subscription.name}</span>{' '}
              <span className="text-muted-foreground">
                — {formatAmount(r.subscription.price, r.subscription.currency)} due {formatDays(r.daysUntil)}
              </span>
            </li>
          ))}
          {reminders.length > 5 && <li className="text-sm text-muted-foreground">…and {reminders.length - 5} more</li>}
        </ul>
      </AlertDescription>
    </Alert>
  )
}
