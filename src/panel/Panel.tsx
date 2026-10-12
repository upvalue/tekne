import { DevTools } from '@/dev/DevTools'
import { Help } from './Help'
import { Search } from './Search'
import { Tools } from './Tools'
import { X } from 'lucide-react'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import { DocumentOverview } from './DocumentOverview'
import { useActivePanelTab, useSetPanelVisible } from '@/hooks/panel-state'
import { cn } from '@/lib/utils'

export function Panel() {
  const [activeTab, setActiveTab] = useActivePanelTab()
  const setPanelVisible = useSetPanelVisible()
  return (
    <aside className="flex flex-col h-dvh pt-[68px] max-lg:pt-6 pr-1">
      <nav
        aria-label="Panel sections"
        className="flex items-center gap-1 pb-3 px-3 text-xs"
      >
        {(['document', 'search'] as const).map((tab) => (
          <button
            key={tab}
            aria-current={activeTab === tab ? 'page' : undefined}
            className={cn(
              'rounded-lg px-3 py-2',
              activeTab === tab
                ? 'bg-white/7 text-text'
                : 'text-text-2 hover:text-text'
            )}
            onClick={() => setActiveTab(tab)}
          >
            {tab === 'document' ? 'This page' : 'Search'}
          </button>
        ))}
        <button
          aria-label="Hide panel"
          className="ml-auto p-2 text-muted lg:hidden"
          onClick={() => setPanelVisible(false)}
        >
          <X size={16} />
        </button>
      </nav>
      <div className="flex-1 overflow-auto min-w-0 pb-6">
        <ErrorBoundary title="Panel crashed">
          {activeTab === 'document' && <DocumentOverview />}
          {activeTab === 'search' && <Search />}
          {activeTab === 'tools' && <Tools />}
          {activeTab === 'help' && <Help />}
          {activeTab === 'devtools' && (
            <div className="p-4 h-full">
              <DevTools />
            </div>
          )}
        </ErrorBoundary>
      </div>
    </aside>
  )
}
