import { useLoaderData } from '@remix-run/react'
import { Settings } from 'lucide-react'
import type React from 'react'
import { useState } from 'react'
import { BudgetProgress } from '~/components/BudgetProgress'
import { NumberTicker } from '~/components/number-ticker'
import { Button } from '~/components/ui/button'
import { Card, CardContent } from '~/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '~/components/ui/dialog'
import { Input } from '~/components/ui/input'
import { Label } from '~/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '~/components/ui/select'
import { convertCurrency } from '~/lib/utils'
import type { loader } from '~/routes/_index'
import { usePreferencesStore } from '~/store/preferences'

interface SummaryProps {
  totals: { [key: string]: number }
}

const Summary: React.FC<SummaryProps> = ({ totals }) => {
  const { selectedCurrency, setSelectedCurrency, monthlyBudget, setMonthlyBudget } = usePreferencesStore()
  const { lastUpdated, rates } = useLoaderData<typeof loader>()
  const [isBudgetDialogOpen, setIsBudgetDialogOpen] = useState(false)
  const [budgetInput, setBudgetInput] = useState('')

  if (!rates || !lastUpdated) {
    return null
  }

  const calculateTotal = () => {
    return Object.entries(totals).reduce((acc, [currency, amount]) => {
      return acc + convertCurrency(amount, currency, selectedCurrency, rates)
    }, 0)
  }

  const convertedTotal = calculateTotal()

  const handleBudgetSave = () => {
    const parsed = Number.parseFloat(budgetInput)
    if (!Number.isNaN(parsed) && parsed > 0) {
      setMonthlyBudget(parsed)
    } else if (budgetInput.trim() === '') {
      setMonthlyBudget(null)
    }
    setIsBudgetDialogOpen(false)
  }

  return (
    <>
      <Card className="mb-6 bg-card shadow-lg">
        <CardContent className="p-4 sm:p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl sm:text-2xl font-bold text-foreground">Summary</h2>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => {
                setBudgetInput(monthlyBudget?.toString() ?? '')
                setIsBudgetDialogOpen(true)
              }}
              aria-label="Set budget"
            >
              <Settings className="h-4 w-4" />
            </Button>
          </div>
          <div className="flex flex-wrap gap-3 sm:gap-4">
            {Object.entries(totals).map(([currency, total]) => (
              <div key={currency} className="flex items-center bg-muted rounded-lg p-2 sm:p-3 shadow-sm">
                <span className="font-semibold mr-1 text-muted-foreground text-sm">{currency}:</span>
                <p className="text-base sm:text-lg font-bold text-foreground">{total.toFixed(0)}</p>
              </div>
            ))}
          </div>
          <div className="mt-4 pt-4 border-t border-border">
            <div className="flex items-center justify-between">
              <div className="flex flex-col">
                <span className="text-lg font-bold text-foreground">Total</span>
                <span className="text-sm text-muted-foreground">
                  Rates for: {new Date(lastUpdated).toLocaleDateString()}
                </span>
              </div>
              <div className="flex items-center">
                <NumberTicker
                  decimalPlaces={2}
                  value={convertedTotal}
                  className="text-xl sm:text-2xl font-bold text-foreground mr-2"
                />
                <Select value={selectedCurrency} onValueChange={setSelectedCurrency}>
                  <SelectTrigger className="w-[80px]">
                    <SelectValue placeholder="Currency" />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.keys(rates).map((currency) => (
                      <SelectItem key={currency} value={currency}>
                        {currency}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Budget progress bar */}
            {monthlyBudget !== null && monthlyBudget > 0 && (
              <BudgetProgress monthlySpend={convertedTotal} budget={monthlyBudget} currency={selectedCurrency} />
            )}
          </div>
        </CardContent>
      </Card>

      {/* Budget Settings Dialog */}
      <Dialog open={isBudgetDialogOpen} onOpenChange={setIsBudgetDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Set Monthly Budget</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 mt-2">
            <div>
              <Label htmlFor="budget-input">Monthly budget in {selectedCurrency} (leave empty to remove)</Label>
              <Input
                id="budget-input"
                type="number"
                min={0}
                step={0.01}
                placeholder="e.g. 100"
                value={budgetInput}
                onChange={(e) => setBudgetInput(e.target.value)}
                className="mt-1"
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setIsBudgetDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleBudgetSave}>Save</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}

export default Summary
