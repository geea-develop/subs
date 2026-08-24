import type { NotificationLeadTime } from '~/store/preferences'
import type { Subscription } from '~/store/subscriptionStore'
import { calculateNextPaymentDate } from '~/utils/nextPaymentDate'

export interface UpcomingReminder {
  subscription: Subscription
  daysUntil: number
  nextPaymentDate: string
}

/**
 * Request browser notification permission.
 * Returns the resulting permission state.
 */
export async function requestNotificationPermission(): Promise<NotificationPermission> {
  if (!('Notification' in window)) {
    return 'denied'
  }
  if (Notification.permission === 'granted') {
    return 'granted'
  }
  if (Notification.permission === 'denied') {
    return 'denied'
  }
  return await Notification.requestPermission()
}

/**
 * Check if browser notifications are supported and granted.
 */
export function canSendNotifications(): boolean {
  return 'Notification' in window && Notification.permission === 'granted'
}

/**
 * Check if browser notifications are supported (regardless of permission state).
 */
export function notificationsSupported(): boolean {
  return 'Notification' in window
}

/**
 * Get subscriptions that are due within the given lead times.
 */
export function getUpcomingReminders(
  subscriptions: Subscription[],
  leadTimes: NotificationLeadTime[],
): UpcomingReminder[] {
  if (leadTimes.length === 0) return []

  const maxDays = Math.max(...leadTimes)
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const reminders: UpcomingReminder[] = []

  for (const sub of subscriptions) {
    if (!sub.billingCycle || !sub.showNextPayment) continue

    const nextDateStr = calculateNextPaymentDate(sub.billingCycle, sub.nextPaymentDate)
    if (!nextDateStr) continue

    const nextDate = new Date(nextDateStr)
    nextDate.setHours(0, 0, 0, 0)

    const diffMs = nextDate.getTime() - today.getTime()
    const daysUntil = Math.round(diffMs / (1000 * 60 * 60 * 24))

    // Check if this subscription falls within any lead time
    if (daysUntil >= 0 && daysUntil <= maxDays && leadTimes.some((lt) => daysUntil <= lt)) {
      reminders.push({
        subscription: sub,
        daysUntil,
        nextPaymentDate: nextDateStr,
      })
    }
  }

  return reminders.sort((a, b) => a.daysUntil - b.daysUntil)
}

/**
 * Format a currency amount for display in notifications.
 */
function formatAmount(price: number, currency: string): string {
  try {
    return new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(price)
  } catch {
    return `${currency} ${price.toFixed(2)}`
  }
}

/**
 * Send a single browser notification for an upcoming subscription.
 */
export function sendSubscriptionNotification(reminder: UpcomingReminder): void {
  if (!canSendNotifications()) return

  const { subscription, daysUntil, nextPaymentDate } = reminder
  const dateLabel = daysUntil === 0 ? 'today' : daysUntil === 1 ? 'tomorrow' : `in ${daysUntil} days`
  const amount = formatAmount(subscription.price, subscription.currency)

  new Notification(`${subscription.name} — ${amount} due ${dateLabel}`, {
    body: `Your ${subscription.billingCycle} subscription renews on ${nextPaymentDate}.`,
    icon: subscription.icon || undefined,
    tag: `sub-reminder-${subscription.id}`,
  })
}

/**
 * Send a single digest notification summarizing all upcoming payments.
 */
export function sendDigestNotification(reminders: UpcomingReminder[]): void {
  if (!canSendNotifications() || reminders.length === 0) return

  const totalAmount = reminders.reduce((sum, r) => sum + r.subscription.price, 0)
  const soonest = reminders[0]
  const dateLabel =
    soonest.daysUntil === 0 ? 'today' : soonest.daysUntil === 1 ? 'tomorrow' : `in ${soonest.daysUntil} days`

  const body =
    reminders.length === 1
      ? `${soonest.subscription.name} renews ${dateLabel}.`
      : `${reminders.length} subscriptions due soon. Next: ${soonest.subscription.name} ${dateLabel}.`

  new Notification(`${reminders.length} upcoming payment${reminders.length > 1 ? 's' : ''}`, {
    body,
    tag: 'sub-reminder-digest',
  })
}

/**
 * Storage key for tracking when notifications were last sent (to avoid duplicates).
 */
const LAST_NOTIFIED_KEY = 'subs-last-notification-date'

/**
 * Check if notifications have already been sent today.
 */
export function hasNotifiedToday(): boolean {
  const last = localStorage.getItem(LAST_NOTIFIED_KEY)
  if (!last) return false
  const today = new Date().toISOString().split('T')[0]
  return last === today
}

/**
 * Mark that notifications have been sent today.
 */
export function markNotifiedToday(): void {
  const today = new Date().toISOString().split('T')[0]
  localStorage.setItem(LAST_NOTIFIED_KEY, today)
}
