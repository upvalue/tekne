import { DevTools } from '@/dev/DevTools'
import { Help } from './Help'
import { Search } from './Search'
import { Tools } from './Tools'
import { AgentPanel } from './agent/AgentPanel'
import {
  Wrench,
  CircleHelp,
  Database,
  SearchIcon,
  Sparkles,
  Zap,
  X,
} from 'lucide-react'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import { DocumentOverview } from './DocumentOverview'
import {
  useActivePanelTab,
  useSetPanelVisible,
  type PanelTab,
} from '@/hooks/panel-state'
import { cn } from '@/lib/utils'

const TABS: Array<{
  id: PanelTab
  label: string
  icon: typeof Database
}> = [
  { id: 'document', label: 'Document', icon: Database },
  { id: 'search', label: 'Search', icon: SearchIcon },
  { id: 'tools', label: 'Tools', icon: Zap },
  { id: 'agent', label: 'Agent', icon: Sparkles },
  { id: 'devtools', label: 'Dev tools', icon: Wrench },
  { id: 'help', label: 'Help', icon: CircleHelp },
]

function RailButton({
  icon: Icon,
  label,
  current,
  onClick,
}: {
  icon: typeof Database
  label: string
  current?: boolean
  onClick: () => void
}) {
  return (
    <div className="relative group">
      <button
        onClick={onClick}
        aria-label={label}
        aria-current={current ? 'true' : undefined}
        className={cn(
          'p-2 rounded transition-colors',
          current
            ? 'bg-zinc-700 text-zinc-100'
            : 'text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200'
        )}
      >
        <Icon className="w-5 h-5" />
      </button>
      <div
        role="tooltip"
        className="absolute right-full top-1/2 -translate-y-1/2 mr-2 px-2 py-1 rounded bg-zinc-800 text-zinc-100 text-xs whitespace-nowrap shadow-md pointer-events-none opacity-0 transition-opacity delay-150 group-hover:opacity-100 group-focus-within:opacity-100 z-20"
      >
        {label}
      </div>
    </div>
  )
}

export function Panel() {
  const [activeTab, setActiveTab] = useActivePanelTab()
  const setPanelVisible = useSetPanelVisible()

  return (
    <div className="flex h-dvh">
      <div className="flex-1 overflow-auto min-w-0">
        <ErrorBoundary title="Panel crashed">
          {activeTab === 'document' && <DocumentOverview />}
          {activeTab === 'search' && <Search />}
          {activeTab === 'tools' && <Tools />}
          {activeTab === 'agent' && <AgentPanel />}
          {activeTab === 'help' && <Help />}
          {activeTab === 'devtools' && (
            <div className="p-4 h-full">
              <DevTools />
            </div>
          )}
        </ErrorBoundary>
      </div>
      <nav
        aria-label="Panel sections"
        className="flex flex-col items-center gap-1 border-l border-zinc-800 px-1.5 py-2 flex-shrink-0"
      >
        <RailButton
          icon={X}
          label="Hide panel"
          onClick={() => setPanelVisible(false)}
        />
        <div className="w-5 border-b border-zinc-800 my-1" />
        {TABS.map(({ id, label, icon }) => (
          <RailButton
            key={id}
            icon={icon}
            label={label}
            current={activeTab === id}
            onClick={() => setActiveTab(id)}
          />
        ))}
      </nav>
    </div>
  )
}
