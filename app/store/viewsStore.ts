import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { CycleOption, SortOption } from '~/hooks/useFilterState'

export interface SavedView {
  id: string
  name: string
  isDefault: boolean
  searchQuery: string
  sortBy: SortOption
  billingCycleFilter: CycleOption
  categoryFilter: string
}

export const DEFAULT_VIEWS: SavedView[] = [
  {
    id: 'default-all',
    name: 'All',
    isDefault: true,
    searchQuery: '',
    sortBy: 'name-asc',
    billingCycleFilter: 'all',
    categoryFilter: 'all',
  },
  {
    id: 'default-upcoming',
    name: 'Upcoming',
    isDefault: true,
    searchQuery: '',
    sortBy: 'next-payment',
    billingCycleFilter: 'all',
    categoryFilter: 'all',
  },
  {
    id: 'default-annual',
    name: 'Annual',
    isDefault: true,
    searchQuery: '',
    sortBy: 'price-desc',
    billingCycleFilter: 'yearly',
    categoryFilter: 'all',
  },
]

interface ViewsStore {
  views: SavedView[]
  activeViewId: string | null
  addView: (view: Omit<SavedView, 'id' | 'isDefault'>) => void
  deleteView: (id: string) => void
  setActiveView: (id: string | null) => void
}

export const useViewsStore = create<ViewsStore>()(
  persist(
    (set) => ({
      views: DEFAULT_VIEWS,
      activeViewId: null,

      addView: (view) => {
        const id = crypto.randomUUID()
        set((state) => ({
          views: [...state.views, { ...view, id, isDefault: false }],
          activeViewId: id,
        }))
      },

      deleteView: (id) =>
        set((state) => ({
          views: state.views.filter((v) => v.id !== id || v.isDefault),
          activeViewId: state.activeViewId === id ? null : state.activeViewId,
        })),

      setActiveView: (id) => set({ activeViewId: id }),
    }),
    {
      name: 'views-storage',
    },
  ),
)
