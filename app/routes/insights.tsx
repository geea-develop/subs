import type { LoaderFunctionArgs, MetaFunction } from '@remix-run/node'
import { json } from '@remix-run/node'
import { Link, useLoaderData } from '@remix-run/react'
import { ArrowLeft, TrendingDown, TrendingUp } from 'lucide-react'
import { useEffect } from 'react'
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from 'recharts'
import { BudgetProgress } from '~/components/BudgetProgress'
import { Badge } from '~/components/ui/badge'
import { Button } from '~/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card'
import { type ChartConfig, ChartContainer, ChartTooltip, ChartTooltipContent } from '~/components/ui/chart'
import { Progress } from '~/components/ui/progress'
import { MONTHLY_MULTIPLIER, convertCurrency } from '~/lib/utils'
import { getCacheHeaders, getCurrencyRates } from '~/services/currency.server'
import { usePreferencesStore } from '~/store/preferences'
import useSubscriptionStore, { type BillingCycle } from '~/store/subscriptionStore'

export const meta: MetaFunction = () => {
  return [{ title: 'Insights – Subs' }, { name: 'description', content: 'Spending insights for your subscriptions' }]
}

export async function loader({ request }: LoaderFunctionArgs) {
  const data = await getCurrencyRates()
  return json({ rates: data?.rates ?? null, lastUpdated: data?.date ?? null }, { headers: getCacheHeaders(data?.date) })
}

export default function Insights() {
  const { rates } = useLoaderData<typeof loader>()
  const { subscriptions } = useSubscriptionStore()
  const { selectedCurrency, monthlyBudget, spendingSnapshots, addSpendingSnapshot } = usePreferencesStore()

  // Convert a subscription price to monthly cost in the selected currency
  const toMonthly = (price: number, currency: string, cycle?: BillingCycle) => {
    if (!rates) return 0
    const multiplier = cycle ? MONTHLY_MULTIPLIER[cycle] : 1
    return convertCurrency(price, currency, selectedCurrency, rates) * multiplier
  }

  const totalMonthly = subscriptions.reduce((acc, sub) => acc + toMonthly(sub.price, sub.currency, sub.billingCycle), 0)

  // Record today's snapshot once per session
  useEffect(() => {
    if (!rates || totalMonthly === 0) return
    const today = new Date().toISOString().split('T')[0]
    const last = spendingSnapshots[spendingSnapshots.length - 1]
    if (!last || last.date !== today) {
      addSpendingSnapshot({ date: today, totalMonthly, currency: selectedCurrency })
    }
  }, [rates, totalMonthly]) // eslint-disable-line react-hooks/exhaustive-deps

  // Spending by category
  const byCategory: Record<string, number> = {}
  for (const sub of subscriptions) {
    const key = sub.category ?? 'Uncategorized'
    byCategory[key] = (byCategory[key] ?? 0) + toMonthly(sub.price, sub.currency, sub.billingCycle)
  }
  const sortedCategories = Object.entries(byCategory).sort(([, a], [, b]) => b - a)
  const maxCategory = sortedCategories[0]?.[1] ?? 1

  // Spending by billing cycle
  const byCycle: Record<string, number> = {}
  for (const sub of subscriptions) {
    const key = sub.billingCycle ?? 'no cycle'
    byCycle[key] = (byCycle[key] ?? 0) + toMonthly(sub.price, sub.currency, sub.billingCycle)
  }

  // Trend helpers: get average monthly spend N days ago
  const getSpendN = (days: number) => {
    const cutoff = new Date()
    cutoff.setDate(cutoff.getDate() - days)
    const cutoffStr = cutoff.toISOString().split('T')[0]
    const inWindow = spendingSnapshots.filter((s) => s.date >= cutoffStr && s.currency === selectedCurrency)
    if (inWindow.length === 0) return null
    return inWindow[0].totalMonthly
  }

  const trend30 = getSpendN(30)
  const trend90 = getSpendN(90)
  const trend365 = getSpendN(365)

  const trendDiff = (old: number | null) => (old !== null ? ((totalMonthly - old) / Math.max(old, 0.01)) * 100 : null)

  const diff30 = trendDiff(trend30)
  const diff90 = trendDiff(trend90)
  const diff365 = trendDiff(trend365)

  const fmt = (n: number) => n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })

  const TrendBadge = ({ diff }: { diff: number | null }) => {
    if (diff === null) return <span className="text-xs text-muted-foreground">No data yet</span>
    if (Math.abs(diff) < 0.5) return <Badge variant="secondary">Stable</Badge>
    return diff > 0 ? (
      <Badge variant="destructive" className="flex items-center gap-1">
        <TrendingUp className="h-3 w-3" />+{diff.toFixed(1)}%
      </Badge>
    ) : (
      <Badge variant="default" className="flex items-center gap-1 bg-green-600">
        <TrendingDown className="h-3 w-3" />
        {diff.toFixed(1)}%
      </Badge>
    )
  }

  // Top subscriptions ranked by monthly cost
  const topSubscriptions = [...subscriptions]
    .sort((a, b) => toMonthly(b.price, b.currency, b.billingCycle) - toMonthly(a.price, a.currency, a.billingCycle))
    .slice(0, 5)

  // Spending over time chart data (last 30 snapshots in selected currency)
  const chartData = spendingSnapshots
    .filter((s) => s.currency === selectedCurrency)
    .slice(-30)
    .map((s) => ({
      date: s.date,
      label: new Date(s.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
      spend: Number(s.totalMonthly.toFixed(2)),
    }))

  const spendChartConfig = {
    spend: { label: `Monthly (${selectedCurrency})`, color: 'hsl(var(--chart-1))' },
  } satisfies ChartConfig

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto py-6 px-3 sm:px-4 lg:px-6">
        <div className="mb-6 flex items-center gap-3">
          <Button asChild variant="outline" size="sm">
            <Link to="/">
              <ArrowLeft className="mr-1 h-4 w-4" />
              Back
            </Link>
          </Button>
          <h1 className="text-2xl font-bold text-foreground">Spending Insights</h1>
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Monthly Total</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">
                {fmt(totalMonthly)} {selectedCurrency}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Annual Total</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">
                {fmt(totalMonthly * 12)} {selectedCurrency}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Subscriptions</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{subscriptions.length}</p>
            </CardContent>
          </Card>
        </div>

        {/* Budget progress */}
        {monthlyBudget !== null && monthlyBudget > 0 && (
          <Card className="mb-6">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Budget</CardTitle>
            </CardHeader>
            <CardContent>
              <BudgetProgress monthlySpend={totalMonthly} budget={monthlyBudget} currency={selectedCurrency} />
            </CardContent>
          </Card>
        )}

        {/* Trends */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Spending Trends</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {[
                { label: 'vs 30 days ago', diff: diff30 },
                { label: 'vs 90 days ago', diff: diff90 },
                { label: 'vs 1 year ago', diff: diff365 },
              ].map(({ label, diff }) => (
                <div key={label} className="flex flex-col gap-1">
                  <span className="text-xs text-muted-foreground">{label}</span>
                  <TrendBadge diff={diff} />
                </div>
              ))}
            </div>
            {spendingSnapshots.length < 2 && (
              <p className="text-xs text-muted-foreground mt-3">
                Trend data accumulates daily. Check back after a few days to see comparisons.
              </p>
            )}
          </CardContent>
        </Card>

        {/* Spending over time chart */}
        {chartData.length >= 2 && (
          <Card className="mb-6" data-testid="spending-chart">
            <CardHeader>
              <CardTitle>Spending Over Time</CardTitle>
            </CardHeader>
            <CardContent>
              <ChartContainer config={spendChartConfig} className="h-[200px] w-full">
                <AreaChart data={chartData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="fillSpend" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--chart-1))" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="hsl(var(--chart-1))" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid vertical={false} strokeDasharray="3 3" />
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                  <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} width={50} />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Area
                    type="monotone"
                    dataKey="spend"
                    stroke="hsl(var(--chart-1))"
                    fill="url(#fillSpend)"
                    strokeWidth={2}
                    dot={false}
                  />
                </AreaChart>
              </ChartContainer>
            </CardContent>
          </Card>
        )}

        {/* Top subscriptions by cost */}
        {topSubscriptions.length > 0 && (
          <Card className="mb-6" data-testid="top-subscriptions">
            <CardHeader>
              <CardTitle>Top Subscriptions by Cost</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {topSubscriptions.map((sub, i) => {
                  const monthlyCost = toMonthly(sub.price, sub.currency, sub.billingCycle)
                  const maxCost = toMonthly(
                    topSubscriptions[0].price,
                    topSubscriptions[0].currency,
                    topSubscriptions[0].billingCycle,
                  )
                  return (
                    <div key={sub.id} className="flex items-center gap-3">
                      <span className="text-sm text-muted-foreground w-4 shrink-0">#{i + 1}</span>
                      {sub.icon && <img src={sub.icon} alt="" className="h-5 w-5 rounded object-contain shrink-0" />}
                      <span className="flex-1 text-sm font-medium truncate">{sub.name}</span>
                      <span className="text-xs text-muted-foreground shrink-0">
                        {fmt(monthlyCost)} {selectedCurrency}/mo
                      </span>
                      <div className="w-20 shrink-0">
                        <Progress value={(monthlyCost / maxCost) * 100} className="h-1.5" />
                      </div>
                    </div>
                  )
                })}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Spending by category */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Spending by Category</CardTitle>
          </CardHeader>
          <CardContent>
            {sortedCategories.length === 0 ? (
              <p className="text-sm text-muted-foreground">No subscriptions yet.</p>
            ) : (
              <div className="space-y-3">
                {sortedCategories.map(([cat, amount]) => (
                  <div key={cat}>
                    <div className="flex justify-between mb-1 text-sm">
                      <span className="font-medium">{cat}</span>
                      <span className="text-muted-foreground">
                        {fmt(amount)} {selectedCurrency}/mo
                      </span>
                    </div>
                    <Progress value={(amount / maxCategory) * 100} className="h-2" />
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Spending by billing cycle */}
        <Card>
          <CardHeader>
            <CardTitle>Spending by Billing Cycle (monthly equivalent)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {Object.entries(byCycle).map(([cycle, amount]) => (
                <div key={cycle} className="bg-muted rounded-lg p-3 text-center">
                  <p className="text-xs text-muted-foreground capitalize mb-1">{cycle}</p>
                  <p className="text-lg font-bold">
                    {fmt(amount)} {selectedCurrency}
                  </p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
