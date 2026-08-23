import { AlertTriangle, TrendingUp } from 'lucide-react'
import { useMemo } from 'react'
import { Progress } from '~/components/ui/progress'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '~/components/ui/tooltip'
import { cn } from '~/lib/utils'
import { calculateProratedSpend, getMonthProgress } from '~/utils/budget'

interface BudgetProgressProps {
  /** Total monthly spend (sum of all subscriptions normalized to monthly, in display currency) */
  monthlySpend: number
  /** User-set monthly budget amount */
  budget: number
  /** Display currency code */
  currency: string
}

/**
 * Displays budget progress with:
 * - Pro-rated "spent so far" bar based on day of month
 * - Projected end-of-month indicator
 * - Warning (80%) and danger (100%) threshold styling
 */
export function BudgetProgress({ monthlySpend, budget, currency }: BudgetProgressProps) {
  if (budget <= 0) return null

  const now = useMemo(() => new Date(), [])
  const monthProgress = getMonthProgress(now)
  const proratedSpend = calculateProratedSpend(monthlySpend, now)

  // Projected month-end is the full monthly spend (subscriptions are deterministic)
  const projectedMonthEnd = monthlySpend

  const percentUsed = Math.min((proratedSpend / budget) * 100, 150)
  const percentProjected = (projectedMonthEnd / budget) * 100

  const isWarning = percentProjected >= 80
  const isOverBudget = percentProjected >= 100

  const barValue = Math.min(percentUsed, 100)

  const statusColor = isOverBudget
    ? 'text-destructive'
    : isWarning
      ? 'text-yellow-600 dark:text-yellow-500'
      : 'text-foreground'
  const barClass = isOverBudget ? '[&>div]:bg-destructive' : isWarning ? '[&>div]:bg-yellow-500' : ''

  const projectedLabel = isOverBudget ? 'Over budget!' : isWarning ? 'Approaching budget' : 'On track'

  return (
    <div className="mt-4" data-testid="budget-progress">
      {/* Header row */}
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-sm text-muted-foreground flex items-center gap-1">
          Monthly budget
          {(isWarning || isOverBudget) && (
            <AlertTriangle
              className={cn('h-3.5 w-3.5', isOverBudget ? 'text-destructive' : 'text-yellow-500')}
              aria-label={isOverBudget ? 'Over budget' : 'Budget warning'}
            />
          )}
        </span>
        <span className={cn('text-sm font-semibold', statusColor)}>
          {proratedSpend.toFixed(0)} / {budget.toFixed(0)} {currency}
        </span>
      </div>

      {/* Progress bar */}
      <div className="relative">
        <Progress value={barValue} className={cn('h-2.5', barClass)} />
        {/* Month progress marker - shows where we are in the month */}
        <div
          className="absolute top-0 h-2.5 w-0.5 bg-foreground/40 rounded-full"
          style={{ left: `${monthProgress * 100}%` }}
          aria-hidden="true"
        />
      </div>

      {/* Projected end-of-month row */}
      <div className="flex items-center justify-between mt-1.5">
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <span className={cn('text-xs flex items-center gap-1 cursor-default', statusColor)}>
                <TrendingUp className="h-3 w-3" />
                {projectedLabel}
              </span>
            </TooltipTrigger>
            <TooltipContent>
              <p>
                Based on your subscriptions, you&apos;ll spend {projectedMonthEnd.toFixed(2)} {currency} this month (
                {percentProjected.toFixed(0)}% of budget)
              </p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
        <span className={cn('text-xs', statusColor)}>
          Projected: {projectedMonthEnd.toFixed(0)} {currency}
          {percentProjected > 100 && ` (+${(percentProjected - 100).toFixed(0)}%)`}
        </span>
      </div>
    </div>
  )
}
