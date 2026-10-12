import {
  PANEL_MIN_WIDTH,
  isWideViewportAtom,
  uiStore,
  usePanelVisible,
  usePanelWidth,
} from '@/hooks/panel-state'
import { useAtomValue } from 'jotai'
import { PanelRight } from 'lucide-react'
import { useCallback, useState } from 'react'

interface EditorLayoutProps {
  editor: React.ReactNode
  sidepanel: React.ReactNode
}

export function EditorLayout({ editor, sidepanel }: EditorLayoutProps) {
  const wide = useAtomValue(isWideViewportAtom, { store: uiStore })
  const [panelVisible, setPanelVisible] = usePanelVisible()
  const [panelWidth, setPanelWidth] = usePanelWidth()
  const [resizing, setResizing] = useState(false)

  const startResize = useCallback(
    (e: React.PointerEvent) => {
      e.preventDefault()
      setResizing(true)
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
        setResizing(false)
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
        <div className="flex-1 min-w-0 Editor">{editor}</div>

        {!panelVisible && (
          <button
            aria-label="Show panel"
            title="Show panel"
            onClick={() => setPanelVisible(true)}
            className="absolute right-3 top-4 z-20 p-2 text-muted hover:text-text rounded bg-panel"
          >
            <PanelRight size={16} />
          </button>
        )}
        {/* Desktop panel (side-by-side, drag left edge to resize) */}
        {wide && (
          <div
            inert={!panelVisible}
            aria-hidden={!panelVisible}
            data-open={panelVisible || undefined}
            data-resizing={resizing || undefined}
            className="hidden lg:block relative flex-shrink-0 PanelShell"
            style={{
              width: panelVisible ? panelWidth : 0,
              maxWidth: '70%',
            }}
          >
            {panelVisible && (
              <div
                onPointerDown={startResize}
                className="absolute inset-y-0 -left-1 w-2 cursor-col-resize z-10 after:absolute after:inset-y-0 after:left-1 after:w-px after:bg-mark after:opacity-0 hover:after:opacity-100 after:transition-opacity"
                role="separator"
                aria-orientation="vertical"
                aria-label="Resize panel"
              />
            )}
            <div
              className="Panel h-dvh overflow-hidden"
              style={{ width: panelWidth }}
            >
              {sidepanel}
            </div>
          </div>
        )}

        {/* Mobile panel (fullscreen overlay, slides in from the right) */}
        {!wide && (
          <div
            inert={!panelVisible}
            aria-hidden={!panelVisible}
            data-open={panelVisible || undefined}
            className="fixed inset-0 z-50 bg-page lg:hidden Panel PanelOverlay overflow-auto"
          >
            {sidepanel}
          </div>
        )}
      </div>
    </div>
  )
}
