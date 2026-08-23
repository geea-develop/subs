import { MONTHLY_MULTIPLIER, convertCurrency } from '~/lib/utils'
import type { Subscription } from '~/store/subscriptionStore'

export interface BudgetStatus {
  /** Current monthly spend (sum of all subs normalized to monthly) */
  currentMonthlySpend: number
  /** Projected total for end of current month based on days elapsed */
  projectedMonthEnd: number
  /** Percentage of budget consumed (current spend) */
  percentUsed: number
  /** Percentage of budget the projected spend represents */
  percentProjected: number
  /** Whether current spend crosses the warning threshold (80%) */
  isWarning: boolean
  /** Whether current spend exceeds the budget (100%) */
  isOverBudget: boolean
  /** Whether projected spend crosses the warning threshold (80%) */
  isProjectedWarning: boolean
  /** Whether projected spend exceeds the budget (100%) */
  isProjectedOverBudget: boolean
}

const WARNING_THRESHOLD = 0.8
const OVER_BUDGET_THRESHOLD = 1.0

/**
 * Calculate how far through the current month we are (0 to 1).
 * Uses the current day relative to total days in the month.
 */
export function getMonthProgress(now: Date = new Date()): number {
  const year = now.getFullYear()
  const month = now.getMonth()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const currentDay = now.getDate()
  return currentDay / daysInMonth
}

/**
 * Calculate the total monthly spend across all subscriptions,
 * converted to the target currency.
 */
export function calculateMonthlySpend(
  subscriptions: Subscription[],
  targetCurrency: string,
  rates: Record<string, number>,
): number {
  return subscriptions.reduce((total, sub) => {
    const multiplier = sub.billingCycle ? MONTHLY_MULTIPLIER[sub.billingCycle] : 1
    const monthlyInOriginalCurrency = sub.price * multiplier
    const converted = convertCurrency(monthlyInOriginalCurrency, sub.currency, targetCurrency, rates)
    return total + converted
  }, 0)
}

/**
 * Calculate the projected month-end spend.
 *
 * For subscriptions, the monthly total is fixed (not pro-rated by days),
 * so the "projected" amount reflects what portion of the month has passed
 * applied to subscriptions that bill within the remaining days.
 *
 * Since subscriptions are recurring at fixed intervals, the projected
 * month-end total equals the full monthly spend — it doesn't scale with
 * days elapsed. The pro-rated "current" spend shows how much of the monthly
 * total you've effectively "consumed" so far this month.
 */
export function calculateProjectedSpend(monthlySpend: number, now: Date = new Date()): number {
  // For subscription tracking, the full monthly total IS the projected end-of-month.
  // The monthly spend is deterministic — all subscriptions will charge their full amount
  // by month end. The projection is simply the total monthly cost.
  return monthlySpend
}

/**
 * Calculate the pro-rated spend consumed so far this month.
 * This gives users a sense of "where they are" relative to budget pace.
 */
export function calculateProratedSpend(monthlySpend: number, now: Date = new Date()): number {
  const progress = getMonthProgress(now)
  return monthlySpend * progress
}

/**
 * Get full budget status including thresholds and projections.
 */
export function getBudgetStatus(
  subscriptions: Subscription[],
  budget: number,
  targetCurrency: string,
  rates: Record<string, number>,
  now: Date = new Date(),
): BudgetStatus {
  const currentMonthlySpend = calculateMonthlySpend(subscriptions, targetCurrency, rates)
  const projectedMonthEnd = calculateProjectedSpend(currentMonthlySpend, now)
  const proratedSpend = calculateProratedSpend(currentMonthlySpend, now)

  const percentUsed = budget > 0 ? (proratedSpend / budget) * 100 : 0
  const percentProjected = budget > 0 ? (projectedMonthEnd / budget) * 100 : 0

  return {
    currentMonthlySpend,
    projectedMonthEnd,
    percentUsed,
    percentProjected,
    isWarning: percentUsed >= WARNING_THRESHOLD * 100,
    isOverBudget: percentUsed >= OVER_BUDGET_THRESHOLD * 100,
    isProjectedWarning: percentProjected >= WARNING_THRESHOLD * 100,
    isProjectedOverBudget: percentProjected >= OVER_BUDGET_THRESHOLD * 100,
  }
}
