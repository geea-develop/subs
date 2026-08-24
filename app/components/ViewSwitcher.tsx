import { Bookmark, Plus, X } from 'lucide-react'
import { useState } from 'react'
import { Badge } from '~/components/ui/badge'
import { Button } from '~/components/ui/button'
import { Input } from '~/components/ui/input'
import { Popover, PopoverContent, PopoverTrigger } from '~/components/ui/popover'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '~/components/ui/tooltip'
import type { CycleOption, SortOption } from '~/hooks/useFilterState'
import { type SavedView, useViewsStore } from '~/store/viewsStore'

interface ViewSwitcherProps {
  currentSearchQuery: string
  currentSortBy: SortOption
  currentBillingCycleFilter: CycleOption
  currentCategoryFilter: string
  hasActiveFilters: boolean
  onApplyView: (view: SavedView) => void
}

export function ViewSwitcher({
  currentSearchQuery,
  currentSortBy,
  currentBillingCycleFilter,
  currentCategoryFilter,
  hasActiveFilters,
  onApplyView,
}: ViewSwitcherProps) {
  const { views, activeViewId, addView, deleteView, setActiveView } = useViewsStore()
  const [saveOpen, setSaveOpen] = useState(false)
  const [newName, setNewName] = useState('')

  const handleApply = (view: SavedView) => {
    setActiveView(view.id)
    onApplyView(view)
  }

  const handleSave = () => {
    const name = newName.trim()
    if (!name) return
    addView({
      name,
      searchQuery: currentSearchQuery,
      sortBy: currentSortBy,
      billingCycleFilter: currentBillingCycleFilter,
      categoryFilter: currentCategoryFilter,
    })
    setNewName('')
    setSaveOpen(false)
  }

  const handleDelete = (e: React.MouseEvent, id: string) => {
    e.stopPropagation()
    deleteView(id)
  }

  return (
    <div className="mb-3 flex flex-wrap items-center gap-2">
      <Bookmark className="h-4 w-4 text-muted-foreground shrink-0" />
      {views.map((view) => (
        <button
          key={view.id}
          type="button"
          onClick={() => handleApply(view)}
          className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-medium transition-colors ${
            activeViewId === view.id
              ? 'bg-primary text-primary-foreground'
              : 'bg-muted text-muted-foreground hover:bg-muted/80'
          }`}
        >
          {view.name}
          {!view.isDefault && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    onClick={(e) => handleDelete(e, view.id)}
                    className="ml-0.5 rounded-full p-0.5 hover:bg-destructive/20"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </TooltipTrigger>
                <TooltipContent>Delete view</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
        </button>
      ))}

      {hasActiveFilters && (
        <Popover open={saveOpen} onOpenChange={setSaveOpen}>
          <PopoverTrigger asChild>
            <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs">
              <Plus className="h-3 w-3" />
              Save view
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-64 p-3" align="start">
            <div className="space-y-2">
              <p className="text-sm font-medium">Save current filters as a view</p>
              <Input
                placeholder="View name"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSave()
                }}
                autoFocus
              />
              <div className="flex flex-wrap gap-1">
                {currentSearchQuery && (
                  <Badge variant="outline" className="text-xs">
                    Search: {currentSearchQuery}
                  </Badge>
                )}
                {currentSortBy !== 'name-asc' && (
                  <Badge variant="outline" className="text-xs">
                    Sort: {currentSortBy}
                  </Badge>
                )}
                {currentBillingCycleFilter !== 'all' && (
                  <Badge variant="outline" className="text-xs">
                    Cycle: {currentBillingCycleFilter}
                  </Badge>
                )}
                {currentCategoryFilter !== 'all' && (
                  <Badge variant="outline" className="text-xs">
                    Category: {currentCategoryFilter}
                  </Badge>
                )}
              </div>
              <Button size="sm" className="w-full" onClick={handleSave} disabled={!newName.trim()}>
                Save
              </Button>
            </div>
          </PopoverContent>
        </Popover>
      )}
    </div>
  )
}
