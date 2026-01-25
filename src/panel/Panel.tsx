import { DevTools } from '@/dev/DevTools'
import { Help } from './Help'
import { Search } from './Search'
import {
  Navbar,
  NavbarSection,
  NavbarItem,
  NavbarLabel,
} from '@/components/vendor/Navbar'
import {
  WrenchScrewdriverIcon,
  QuestionMarkCircleIcon,
  CircleStackIcon,
  MagnifyingGlassIcon,
} from '@heroicons/react/24/solid'
import { useAtom } from 'jotai'
import { useEffect } from 'react'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import { DocumentOverview } from './DocumentOverview'
import { activePanelTabAtom, type PanelTab } from './state'

export function Panel() {
  const [activeTab, setActiveTab] = useAtom(activePanelTabAtom)

  // Listen for panel tab change events from command palette
  useEffect(() => {
    const handler = (e: CustomEvent<{ tab: PanelTab }>) => {
      setActiveTab(e.detail.tab)
    }
    window.addEventListener('tekne:panel-tab', handler as EventListener)
    return () => window.removeEventListener('tekne:panel-tab', handler as EventListener)
  }, [setActiveTab])

  return (
    <div className="flex flex-col h-[100vh]">
      <div className="flex items-center border-b border-zinc-800 px-2 py-1 flex-shrink-0">
        <Navbar className="bg-transparent p-0 h-auto gap-1">
          <NavbarSection>
            <NavbarItem
              current={activeTab === 'document'}
              onClick={() => setActiveTab('document')}
            >
              <CircleStackIcon className="w-4 h-4" data-slot="icon" />
              <NavbarLabel>Document</NavbarLabel>
            </NavbarItem>

            <NavbarItem
              current={activeTab === 'search'}
              onClick={() => setActiveTab('search')}
            >
              <MagnifyingGlassIcon className="w-4 h-4" data-slot="icon" />
              <NavbarLabel>Search</NavbarLabel>
            </NavbarItem>

            <NavbarItem
              current={activeTab === 'help'}
              onClick={() => setActiveTab('help')}
            >
              <QuestionMarkCircleIcon className="w-4 h-4" data-slot="icon" />
              <NavbarLabel>Help</NavbarLabel>
            </NavbarItem>

            <NavbarItem
              current={activeTab === 'devtools'}
              onClick={() => setActiveTab('devtools')}
            >
              <WrenchScrewdriverIcon className="w-4 h-4" data-slot="icon" />
              <NavbarLabel>Dev</NavbarLabel>
            </NavbarItem>
          </NavbarSection>
        </Navbar>
      </div>
      <div className="flex-1 overflow-auto min-h-0">
        <ErrorBoundary title="Panel crashed">
          {activeTab === 'document' && <DocumentOverview />}
          {activeTab === 'search' && <Search />}
          {activeTab === 'help' && <Help />}
          {activeTab === 'devtools' && (
            <div className="p-4 h-full">
              <DevTools />
            </div>
          )}
        </ErrorBoundary>
      </div>
    </div>
  )
}
