import { DevTools } from '@/dev/DevTools'
import { Search } from './Search'
import { Tools } from './Tools'
import { X, FileText, SearchIcon, Zap, CircleHelp, Wrench } from 'lucide-react'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import { DocumentOverview } from './DocumentOverview'
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
  return (
    <aside className="flex flex-col h-dvh pt-4">
      <nav
        aria-label="Panel sections"
        className="flex items-center gap-1 pb-2 px-1 text-xs"
      >
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
                'rounded p-2',
                activeTab === id
                  ? 'bg-white/7 text-text'
                  : 'text-text-2 hover:text-text'
              )}
              onClick={() => setActiveTab(id)}
            >
              <Icon size={16} />
            </button>
          </Tooltip>
        ))}
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
            className="p-2 text-muted hover:text-text"
            onClick={() => setPanelVisible(false)}
          >
            <X size={16} />
          </button>
        </Tooltip>
      </nav>
      <div className="flex-1 overflow-auto min-w-0 pb-6">
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
    </aside>
  )
}
