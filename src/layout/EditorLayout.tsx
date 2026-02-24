import { useAtom } from 'jotai'
import { panelVisibleAtom } from '@/panel/state'
import { Bars3Icon, XMarkIcon } from '@heroicons/react/24/solid'

interface EditorLayoutProps {
  editor: React.ReactNode
  sidepanel: React.ReactNode
}

export function EditorLayout({ editor, sidepanel }: EditorLayoutProps) {
  const [panelVisible, setPanelVisible] = useAtom(panelVisibleAtom)

  return (
    <div className="w-full flex flex-col relative">
      <div className="flex flex-grow">
        <div className={panelVisible ? 'w-full lg:w-[60%] Editor' : 'w-full Editor'}>
          {editor}
        </div>

        {/* Toggle button — on mobile, hidden when panel is open (close button inside panel is used instead) */}
        <button
          onClick={() => setPanelVisible((v) => !v)}
          className={`fixed top-2 right-2 z-[60] p-1.5 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-zinc-200 transition-colors ${panelVisible ? 'hidden lg:block' : ''}`}
          aria-label={panelVisible ? 'Hide panel' : 'Show panel'}
        >
          {panelVisible ? (
            <XMarkIcon className="w-5 h-5" />
          ) : (
            <Bars3Icon className="w-5 h-5" />
          )}
        </button>

        {/* Desktop panel (side-by-side) */}
        {panelVisible && (
          <div className="hidden lg:block w-[40%] Panel">{sidepanel}</div>
        )}

        {/* Mobile panel (fullscreen overlay) */}
        {panelVisible && (
          <div className="fixed inset-0 z-50 bg-zinc-900 lg:hidden Panel overflow-auto">
            {sidepanel}
          </div>
        )}
      </div>
    </div>
  )
}
