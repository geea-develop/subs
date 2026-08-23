import { create } from 'zustand'
import { validateImportData } from '~/utils/importValidation'

export type BillingCycle = 'monthly' | 'yearly' | 'weekly' | 'daily'

export const SUBSCRIPTION_CATEGORIES = [
  'Streaming',
  'Music',
  'Cloud',
  'AI Tools',
  'Productivity',
  'Gaming',
  'News & Media',
  'Health & Fitness',
  'Education',
  'Finance',
  'Developer Tools',
  'Other',
] as const

export type SubscriptionCategory = (typeof SUBSCRIPTION_CATEGORIES)[number]

export type SubscriptionSource = 'manual' | 'email'

export interface Subscription {
  id: string
  name: string
  price: number
  currency: string
  domain: string
  icon?: string
  billingCycle?: BillingCycle
  nextPaymentDate?: string // ISO date string
  showNextPayment?: boolean
  category?: SubscriptionCategory
  source?: SubscriptionSource
  sourceEmailId?: string // Gmail message ID if imported from email
  importedAt?: string // ISO date string
  // Lifecycle metadata
  trialEndDate?: string // ISO date string — when the free trial ends
  cancellationUrl?: string // Direct link to cancel the subscription
  accountEmail?: string // Email used for the subscription account
  notes?: string // Freeform internal notes
  contractEndDate?: string // ISO date string — when annual/multi-year contract ends
}

export interface SubscriptionTemplate {
  label: string
  name: string
  domain: string
  billingCycle: BillingCycle
  price: number
  currency: string
  category?: SubscriptionCategory
  /** ISO country name e.g. "France", "Japan" — used for regional filtering */
  region?: string
  /** Appears in the Popular tab in the onboarding dialog */
  popular?: boolean
}

interface SubscriptionStore {
  subscriptions: Subscription[]
  lastImportedAt?: string
  initialized: boolean
  fetchSubscriptions: () => Promise<void>
  addSubscription: (subscription: Omit<Subscription, 'id'>) => void
  editSubscription: (id: string, updatedSubscription: Partial<Omit<Subscription, 'id'>>) => void
  deleteSubscription: (id: string) => void
  restoreSubscription: (subscription: Subscription, index?: number) => void
  exportSubscriptions: () => string
  importSubscriptions: (data: string) => void
  replaceSubscriptions: (subscriptions: Subscription[]) => void
  resetToDefault: () => void
}

export const defaultSubscriptions: Subscription[] = [
  { id: '1', name: 'Netflix', price: 15.99, currency: 'USD', domain: 'https://netflix.com' },
  { id: '2', name: 'Spotify', price: 9.99, currency: 'USD', domain: 'https://spotify.com' },
  { id: '3', name: 'Amazon Prime', price: 14.99, currency: 'USD', domain: 'https://amazon.com' },
  { id: '4', name: 'Disney+', price: 7.99, currency: 'USD', domain: 'https://disneyplus.com' },
  { id: '5', name: 'YouTube Premium', price: 11.99, currency: 'USD', domain: 'https://youtube.com' },
  { id: '6', name: 'Hulu', price: 7.99, currency: 'USD', domain: 'https://hulu.com' },
  { id: '7', name: 'Apple Music', price: 9.99, currency: 'JPY', domain: 'https://apple.com/apple-music' },
  { id: '8', name: 'HBO Max', price: 14.99, currency: 'JPY', domain: 'https://hbomax.com' },
  { id: '9', name: 'Adobe Creative Cloud', price: 52.99, currency: 'EUR', domain: 'https://adobe.com' },
  { id: '10', name: 'Microsoft 365', price: 6.99, currency: 'EUR', domain: 'https://microsoft.com' },
]

const useSubscriptionStore = create<SubscriptionStore>()((set, get) => ({
  subscriptions: [],
  lastImportedAt: undefined,
  initialized: false,

  fetchSubscriptions: async () => {
    try {
      const response = await fetch('/api/subscriptions')
      if (!response.ok) throw new Error('Failed to fetch subscriptions')
      const data = await response.json()
      set({ subscriptions: data.subscriptions, initialized: true })
    } catch (error) {
      console.error('Error fetching subscriptions:', error)
      set({ subscriptions: defaultSubscriptions, initialized: true })
    }
  },

  addSubscription: async (subscription) => {
    // Optimistically add with a temporary id
    const tempId = crypto.randomUUID()
    const optimistic = { ...subscription, id: tempId }
    set((state) => ({ subscriptions: [...state.subscriptions, optimistic] }))

    try {
      const response = await fetch('/api/subscriptions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(subscription),
      })
      if (!response.ok) throw new Error('Failed to create subscription')
      const data = await response.json()
      // Replace temp with server-assigned id
      set((state) => ({
        subscriptions: state.subscriptions.map((s) => (s.id === tempId ? data.subscription : s)),
      }))
    } catch (error) {
      console.error('Error creating subscription:', error)
      // Rollback
      set((state) => ({ subscriptions: state.subscriptions.filter((s) => s.id !== tempId) }))
    }
  },

  editSubscription: async (id, updatedSubscription) => {
    const prev = get().subscriptions.find((s) => s.id === id)
    // Optimistic update
    set((state) => ({
      subscriptions: state.subscriptions.map((sub) => (sub.id === id ? { ...sub, ...updatedSubscription } : sub)),
    }))

    try {
      const response = await fetch(`/api/subscriptions/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedSubscription),
      })
      if (!response.ok) throw new Error('Failed to update subscription')
    } catch (error) {
      console.error('Error updating subscription:', error)
      // Rollback
      if (prev) {
        set((state) => ({
          subscriptions: state.subscriptions.map((sub) => (sub.id === id ? prev : sub)),
        }))
      }
    }
  },

  deleteSubscription: async (id) => {
    const prev = get().subscriptions
    // Optimistic delete
    set((state) => ({ subscriptions: state.subscriptions.filter((sub) => sub.id !== id) }))

    try {
      const response = await fetch(`/api/subscriptions/${id}`, { method: 'DELETE' })
      if (!response.ok) throw new Error('Failed to delete subscription')
    } catch (error) {
      console.error('Error deleting subscription:', error)
      set({ subscriptions: prev })
    }
  },

  restoreSubscription: async (subscription, index) => {
    set((state) => {
      const subs = [...state.subscriptions]
      if (index !== undefined && index >= 0 && index <= subs.length) {
        subs.splice(index, 0, subscription)
      } else {
        subs.push(subscription)
      }
      return { subscriptions: subs }
    })

    try {
      await fetch('/api/subscriptions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(subscription),
      })
    } catch (error) {
      console.error('Error restoring subscription:', error)
    }
  },

  exportSubscriptions: () => JSON.stringify(get().subscriptions, null, 2),

  importSubscriptions: async (data) => {
    const report = validateImportData(data)
    if (report.invalidCount > 0) {
      throw new Error('Invalid subscription data format')
    }
    const subscriptions = report.rows.map((r) => r.subscription as Subscription)

    try {
      const response = await fetch('/api/subscriptions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'replace', subscriptions }),
      })
      if (!response.ok) throw new Error('Failed to import subscriptions')
      const result = await response.json()
      set({ subscriptions: result.subscriptions, lastImportedAt: new Date().toISOString() })
    } catch (error) {
      console.error('Failed to import subscriptions:', error)
      throw error
    }
  },

  replaceSubscriptions: async (subscriptions) => {
    const prev = get().subscriptions
    set({ subscriptions })

    try {
      const response = await fetch('/api/subscriptions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'replace', subscriptions }),
      })
      if (!response.ok) throw new Error('Failed to replace subscriptions')
    } catch (error) {
      console.error('Error replacing subscriptions:', error)
      set({ subscriptions: prev })
    }
  },

  resetToDefault: async () => {
    set({ subscriptions: defaultSubscriptions })
    try {
      await fetch('/api/subscriptions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'replace', subscriptions: defaultSubscriptions }),
      })
    } catch (error) {
      console.error('Error resetting subscriptions:', error)
    }
  },
}))

export default useSubscriptionStore
