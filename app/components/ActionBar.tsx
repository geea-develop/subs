import { Link } from '@remix-run/react'
import { BarChart2, Download, SlidersHorizontal, Sparkles, Upload } from 'lucide-react'
import type React from 'react'
import { Button } from '~/components/ui/button'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '~/components/ui/tooltip'
import { EmailImportDialog } from '~/components/EmailImportDialog'

interface ActionBarProps {
  subscriptionCount: number
  lastImportedAt?: string
  onExport: () => void
  onImport: () => void
  onQuickSetup: () => void
  fileInputRef: React.RefObject<HTMLInputElement>
  onFileChange: (event: React.ChangeEvent<HTMLInputElement>) => void
}

export function ActionBar({
  subscriptionCount,
  lastImportedAt,
  onExport,
  onImport,
  onQuickSetup,
  fileInputRef,
  onFileChange,
}: ActionBarProps) {
  return (
    <div className="mb-6 flex flex-col sm:flex-row justify-between items-center">
      <div>
        <h2 className="text-xl font-bold text-foreground mb-1">Manage {subscriptionCount} Subscriptions</h2>
      </div>
      <div className="flex gap-1 items-center">
        <Button onClick={onQuickSetup} size="sm" variant="outline" className="rounded-none rounded-tl-md rounded-bl-md">
          <Sparkles className="mr-1 h-3 w-3" />
          Quick Setup
        </Button>
        <Button onClick={onExport} size="sm" variant="outline" className="rounded-none">
          <Download className="mr-1 h-3 w-3" />
          Export
        </Button>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                onClick={onImport}
                size="sm"
                variant="outline"
                className="rounded-none"
                data-testid="import-button"
              >
                <Upload className="mr-1 h-3 w-3" />
                Import
                {lastImportedAt && (
                  <span className="ml-1 h-1.5 w-1.5 rounded-full bg-green-500 inline-block" aria-hidden="true" />
                )}
              </Button>
            </TooltipTrigger>
            {lastImportedAt && (
              <TooltipContent side="bottom">
                Last imported:{' '}
                {new Date(lastImportedAt).toLocaleString(undefined, {
                  dateStyle: 'medium',
                  timeStyle: 'short',
                })}
              </TooltipContent>
            )}
          </Tooltip>
        </TooltipProvider>
        <Button asChild size="sm" variant="outline" className="rounded-none">
          <Link to="/insights">
            <BarChart2 className="mr-1 h-3 w-3" />
            Insights
          </Link>
        </Button>
        <EmailImportDialog />
        <Button asChild size="sm" variant="outline" className="rounded-none rounded-tr-md rounded-br-md">
          <Link to="/manage">
            <SlidersHorizontal className="mr-1 h-3 w-3" />
            Edit All
          </Link>
        </Button>
        <input ref={fileInputRef} type="file" accept=".json" className="hidden" onChange={onFileChange} />
      </div>
    </div>
  )
}
