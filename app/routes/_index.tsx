import type { LoaderFunctionArgs, MetaFunction } from '@remix-run/node'
import { json } from '@remix-run/node'
import { useLoaderData } from '@remix-run/react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'
import { ActionBar } from '~/components/ActionBar'
import EditSubscriptionModal from '~/components/EditSubscriptionModal'
import { FilterBar } from '~/components/FilterBar'
import Header from '~/components/Header'
import ImportDuplicateDialog from '~/components/ImportDuplicateDialog'
import ImportValidationReportDialog from '~/components/ImportValidationReportDialog'
import { InAppReminders } from '~/components/InAppReminders'
import KeyboardShortcutsDialog from '~/components/KeyboardShortcutsDialog'
import { NotificationSettingsDialog } from '~/components/NotificationSettingsDialog'
import OnboardingDialog from '~/components/OnboardingDialog'
import SubscriptionGrid from '~/components/SubscriptionGrid'
import Summary from '~/components/Summary'
import UpcomingPaymentsPanel from '~/components/UpcomingPaymentsPanel'
import { ViewSwitcher } from '~/components/ViewSwitcher'
import { useDeleteWithUndo } from '~/hooks/useDeleteWithUndo'
import { useFilterState } from '~/hooks/useFilterState'
import { useImportFlow } from '~/hooks/useImportFlow'
import { useKeyboard } from '~/hooks/useKeyboard'
import { useSubscriptionModal } from '~/hooks/useSubscriptionModal'
import { getCacheHeaders, getCurrencyRates } from '~/services/currency.server'
import { usePreferencesStore } from '~/store/preferences'
import useSubscriptionStore from '~/store/subscriptionStore'
import { useViewsStore } from '~/store/viewsStore'
import {
  canSendNotifications,
  getUpcomingReminders,
  hasNotifiedToday,
  markNotifiedToday,
  notificationsSupported,
  sendDigestNotification,
  sendSubscriptionNotification,
} from '~/utils/notifications'
import { calculateTotals } from '~/utils/subscriptions'

export const meta: MetaFunction = () => [
  { title: 'Subs - Subscription Tracker' },
  { name: 'description', content: 'Easily track your subscriptions' },
]

export async function loader({ request: _request }: LoaderFunctionArgs) {
  const data = await getCurrencyRates()
  return json({ rates: data?.rates ?? null, lastUpdated: data?.date ?? null }, { headers: getCacheHeaders(data?.date) })
}

export default function Index() {
  const { rates } = useLoaderData<typeof loader>()
  const [isAddPopoverOpen, setIsAddPopoverOpen] = useState(false)
  const [isKeyboardShortcutsOpen, setIsKeyboardShortcutsOpen] = useState(false)
  const [isOnboardingOpen, setIsOnboardingOpen] = useState(false)
  const [isNotificationSettingsOpen, setIsNotificationSettingsOpen] = useState(false)
  const searchBarRef = useRef<HTMLInputElement>(null)

  const {
    subscriptions,
    lastImportedAt,
    addSubscription,
    editSubscription,
    deleteSubscription,
    restoreSubscription,
    exportSubscriptions,
    replaceSubscriptions,
  } = useSubscriptionStore()

  const modal = useSubscriptionModal({ subscriptions, addSubscription, editSubscription })
  const { handleDelete } = useDeleteWithUndo({ subscriptions, deleteSubscription, restoreSubscription })
  const importFlow = useImportFlow({ subscriptions, replaceSubscriptions })
  const filters = useFilterState(subscriptions)

  const totals = useMemo(() => calculateTotals(subscriptions, rates), [subscriptions, rates])

  // Check and send notifications once per day on page load
  const { notificationsEnabled, notificationLeadTimes, notificationDigestMode } = usePreferencesStore()
  useEffect(() => {
    if (!notificationsEnabled || !canSendNotifications() || hasNotifiedToday()) return
    if (subscriptions.length === 0) return

    const reminders = getUpcomingReminders(subscriptions, notificationLeadTimes)
    if (reminders.length === 0) return

    if (notificationDigestMode) {
      sendDigestNotification(reminders)
    } else {
      for (const reminder of reminders) {
        sendSubscriptionNotification(reminder)
      }
    }
    markNotifiedToday()
  }, [subscriptions, notificationsEnabled, notificationLeadTimes, notificationDigestMode])

  // In-app fallback: show reminders when notifications are enabled but browser permission denied/unsupported
  const inAppReminders = useMemo(() => {
    if (!notificationsEnabled || canSendNotifications() || !notificationsSupported()) return []
    return getUpcomingReminders(subscriptions, notificationLeadTimes)
  }, [subscriptions, notificationsEnabled, notificationLeadTimes])

  const handleExport = async () => {
    try {
      const data = await exportSubscriptions()
      const blob = new Blob([data], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'subscriptions.json'
      a.click()
      URL.revokeObjectURL(url)
      toast.success(`${subscriptions.length} subscriptions exported successfully.`)
    } catch {
      toast.error('Failed to export subscriptions. Please try again.')
    }
  }

  useKeyboard([
    { key: 'n', handler: () => setIsAddPopoverOpen(true), description: 'Add new subscription' },
    { key: 'a', handler: () => setIsAddPopoverOpen(true), description: 'Focus Add Subscription form' },
    { key: '/', handler: () => searchBarRef.current?.focus(), description: 'Focus search bar' },
    { key: 'e', ctrl: true, handler: handleExport, description: 'Export subscriptions' },
    { key: 'i', ctrl: true, handler: importFlow.triggerFileInput, description: 'Import subscriptions' },
    { key: '?', handler: () => setIsKeyboardShortcutsOpen(true), description: 'Show keyboard shortcuts' },
    { key: 's', handler: filters.cycleSortOption, description: 'Cycle sort order' },
    { key: 'f', handler: filters.cycleBillingFilter, description: 'Cycle billing cycle filter' },
    { key: 'c', handler: filters.cycleCategoryFilter, description: 'Cycle category filter' },
    {
      key: 'Escape',
      handler: () => {
        if (modal.isOpen) modal.close()
        else if (importFlow.importDuplicates.length > 0) importFlow.clearDuplicateState()
        else if (isAddPopoverOpen) setIsAddPopoverOpen(false)
        else if (isKeyboardShortcutsOpen) setIsKeyboardShortcutsOpen(false)
      },
      description: 'Close dialogs',
    },
  ])

  return (
    <div className="min-h-screen bg-background">
      <Header addPopoverOpen={isAddPopoverOpen} onAddPopoverOpenChange={setIsAddPopoverOpen} />
      <main className="container mx-auto py-6 px-3 sm:px-4 lg:px-6">
        <ActionBar
          subscriptionCount={subscriptions.length}
          lastImportedAt={lastImportedAt}
          onExport={handleExport}
          onImport={importFlow.triggerFileInput}
          onQuickSetup={() => setIsOnboardingOpen(true)}
          onOpenNotificationSettings={() => setIsNotificationSettingsOpen(true)}
          fileInputRef={importFlow.fileInputRef}
          onFileChange={importFlow.handleFileChange}
        />
        <Summary totals={totals} />
        <UpcomingPaymentsPanel
          subscriptions={subscriptions}
          rates={rates}
          onMarkPaid={(id, nextDate) => editSubscription(id, { nextPaymentDate: nextDate })}
        />
        <InAppReminders reminders={inAppReminders} />
        <ViewSwitcher
          currentSearchQuery={filters.searchQuery}
          currentSortBy={filters.sortBy}
          currentBillingCycleFilter={filters.billingCycleFilter}
          currentCategoryFilter={filters.categoryFilter}
          hasActiveFilters={filters.hasActiveFilters}
          onApplyView={(view) => {
            filters.setSearchQuery(view.searchQuery)
            filters.setSortBy(view.sortBy)
            filters.setBillingCycleFilter(view.billingCycleFilter)
            filters.setCategoryFilter(view.categoryFilter)
          }}
        />
        <FilterBar
          searchBarRef={searchBarRef}
          searchQuery={filters.searchQuery}
          onSearch={filters.setSearchQuery}
          sortBy={filters.sortBy}
          onSortChange={filters.setSortBy}
          billingCycleFilter={filters.billingCycleFilter}
          onBillingCycleChange={filters.setBillingCycleFilter}
          categoryFilter={filters.categoryFilter}
          onCategoryChange={filters.setCategoryFilter}
          filteredCount={filters.filteredSubscriptions.length}
          totalCount={subscriptions.length}
          hasActiveFilters={filters.hasActiveFilters}
          onClearFilters={() => {
            filters.clearFilters()
            useViewsStore.getState().setActiveView(null)
          }}
        />
        <SubscriptionGrid
          subscriptions={filters.filteredSubscriptions}
          onEditSubscription={modal.openEdit}
          onDeleteSubscription={handleDelete}
          searchQuery={filters.searchQuery}
          onClearSearch={() => filters.setSearchQuery('')}
          onAddSubscription={() => setIsAddPopoverOpen(true)}
          onAddWithTemplate={modal.openWithTemplate}
          onQuickSetup={() => setIsOnboardingOpen(true)}
          totalCount={subscriptions.length}
        />
      </main>

      <EditSubscriptionModal
        isOpen={modal.isOpen}
        onClose={modal.close}
        onSave={modal.save}
        editingSubscription={modal.editingSubscription}
        templateValues={modal.pendingTemplate}
      />
      <ImportDuplicateDialog
        isOpen={importFlow.importDuplicates.length > 0}
        onClose={importFlow.clearDuplicateState}
        duplicates={importFlow.importDuplicates}
        onResolve={importFlow.resolveDuplicates}
      />
      <KeyboardShortcutsDialog isOpen={isKeyboardShortcutsOpen} onClose={() => setIsKeyboardShortcutsOpen(false)} />
      <NotificationSettingsDialog
        isOpen={isNotificationSettingsOpen}
        onClose={() => setIsNotificationSettingsOpen(false)}
      />
      <OnboardingDialog open={isOnboardingOpen} onOpenChange={setIsOnboardingOpen} addSubscription={addSubscription} />
      <ImportValidationReportDialog
        isOpen={importFlow.isReportOpen}
        report={importFlow.importReport}
        onClose={importFlow.closeReport}
        onImportValid={importFlow.importValidRows}
      />
    </div>
  )
}
