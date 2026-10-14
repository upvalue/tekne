import { DevTools } from '@/dev/DevTools'
import { Search } from './Search'
import { Tools } from './Tools'
import { X, FileText, SearchIcon, Zap, CircleHelp, Wrench } from 'lucide-react'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import { DocumentOverview } from './DocumentOverview'
import { DocumentDetails } from '@/editor/DocumentDetails'
import { useDocTitle } from '@/hooks/useDocTitle'
import {
  openHelp,
  useActivePanelTab,
  useSetPanelVisible,
} from '@/hooks/panel-state'
import { Tooltip } from '@/components/vendor/Tooltip'
import { cn } from '@/lib/utils'

export function Panel() {
  const [activeTab, setActiveTab] = useActivePanelTab()
  const setPanelVisible = useSetPanelVisible()
  const title = useDocTitle()
  return (
    <aside className="flex flex-col AppViewport pt-4">
      <nav
        aria-label="Panel sections"
        className="flex items-center gap-1 pb-2 px-3 text-xs"
      >
        <div className="flex gap-0.5 rounded-lg bg-white/[0.04] p-0.5">
          {[
            {
              id: 'document' as const,
              label: 'This page',
              icon: FileText,
            },
            {
              id: 'search' as const,
              label: 'Search',
              icon: SearchIcon,
            },
            {
              id: 'tools' as const,
              label: 'Tools',
              icon: Zap,
            },
            {
              id: 'devtools' as const,
              label: 'Dev tools',
              icon: Wrench,
            },
          ].map(({ id, label, icon: Icon }) => (
            <Tooltip key={id} label={label}>
              <button
                aria-label={label}
                aria-current={activeTab === id ? 'page' : undefined}
                className={cn(
                  'flex size-7 items-center justify-center rounded-md transition-colors',
                  activeTab === id
                    ? 'bg-white/10 text-text shadow-[inset_0_0_0_0.5px_rgba(255,255,255,0.14),0_1px_2px_rgba(0,0,0,0.35)]'
                    : 'text-muted hover:text-text-2'
                )}
                onClick={() => setActiveTab(id)}
              >
                <Icon size={15} />
              </button>
            </Tooltip>
          ))}
        </div>
        <Tooltip label="Help">
          <button
            aria-label="Help"
            aria-haspopup="dialog"
            className="ml-auto rounded p-2 text-text-2 hover:text-text"
            onClick={openHelp}
          >
            <CircleHelp size={16} />
          </button>
        </Tooltip>
        <Tooltip label="Hide panel">
          <button
            aria-label="Hide panel"
            className="-mr-2 p-2 text-muted hover:text-text"
            onClick={() => setPanelVisible(false)}
          >
            <X size={16} />
          </button>
        </Tooltip>
      </nav>
      <div className="flex flex-col flex-1 overflow-auto min-h-0 min-w-0 pb-4">
        <ErrorBoundary title="Panel crashed">
          {activeTab === 'document' && <DocumentOverview />}
          {activeTab === 'search' && <Search />}
          {activeTab === 'tools' && <Tools />}
          {activeTab === 'devtools' && (
            <div className="p-2 h-full">
              <DevTools />
            </div>
          )}
        </ErrorBoundary>
      </div>
      {activeTab === 'document' && title && (
        <footer aria-label="Document details" className="PanelFooter">
          <DocumentDetails title={title} />
        </footer>
      )}
    </aside>
  )
}
