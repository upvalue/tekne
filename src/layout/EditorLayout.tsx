import {
  PANEL_MIN_WIDTH,
  usePanelVisible,
  usePanelWidth,
} from '@/hooks/panel-state'
import { Menu } from 'lucide-react'
import { useCallback } from 'react'

interface EditorLayoutProps {
  editor: React.ReactNode
  sidepanel: React.ReactNode
}

export function EditorLayout({ editor, sidepanel }: EditorLayoutProps) {
  const [panelVisible, setPanelVisible] = usePanelVisible()
  const [panelWidth, setPanelWidth] = usePanelWidth()

  const startResize = useCallback(
    (e: React.PointerEvent) => {
      e.preventDefault()
      document.body.style.cursor = 'col-resize'
      document.body.style.userSelect = 'none'
      const onMove = (ev: PointerEvent) => {
        const max = Math.round(window.innerWidth * 0.7)
        setPanelWidth(
          Math.min(
            Math.max(window.innerWidth - ev.clientX, PANEL_MIN_WIDTH),
            max
          )
        )
      }
      const stop = () => {
        document.body.style.cursor = ''
        document.body.style.userSelect = ''
        window.removeEventListener('pointermove', onMove)
        window.removeEventListener('pointerup', stop)
      }
      window.addEventListener('pointermove', onMove)
      window.addEventListener('pointerup', stop)
    },
    [setPanelWidth]
  )

  return (
    <div className="w-full flex flex-col relative">
      <div className="flex flex-grow">
        <div
          className={panelVisible ? 'flex-1 min-w-0 Editor' : 'w-full Editor'}
        >
          {editor}
        </div>

        {/* Reopen button — when the panel is open, its rail carries the close button */}
        {!panelVisible && (
          <button
            onClick={() => setPanelVisible(true)}
            className="fixed top-2 right-2 z-[60] p-1.5 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-zinc-200 transition-colors"
            aria-label="Show panel"
          >
            <Menu className="w-5 h-5" />
          </button>
        )}

        {/* Desktop panel (side-by-side, drag left edge to resize) */}
        {panelVisible && (
          <div
            className="hidden lg:block relative flex-shrink-0 Panel"
            style={{
              width: panelWidth,
              minWidth: PANEL_MIN_WIDTH,
              maxWidth: '70%',
            }}
          >
            <div
              onPointerDown={startResize}
              className="absolute inset-y-0 -left-1 w-2 cursor-col-resize z-10 hover:bg-zinc-600/40 transition-colors"
              role="separator"
              aria-orientation="vertical"
              aria-label="Resize panel"
            />
            {sidepanel}
          </div>
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
