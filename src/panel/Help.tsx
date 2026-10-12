import { Dialog, DialogContent, DialogTitle } from '@/components/vendor/Dialog'
import { useHelpOpen } from '@/hooks/panel-state'
import { LoadingIndicator } from '@/components/LoadingIndicator'
import React, { useState, useMemo, useCallback } from 'react'
import { Badge } from '@/components/vendor/Badge'
import {
  DescriptionDetails,
  DescriptionList,
  DescriptionTerm,
} from '@/components/vendor/DescriptionList'
import { displayKey, getAllKeybindings, keybindings, modName } from '@/lib/keys'
import { DocsWrapper } from '@/documentation/DocsWrapper'
import { Version } from '@/documentation/Version'
import manifest from '@/documentation/generated/manifest.json'
import { ExternalLink } from '@/components/ExternalLink'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import { getAllCommands } from '@/editor/command-registry'

// One lazy component per generated doc page, created once at module scope —
// calling React.lazy during render would remount (and refetch) the chunk on
// every render.
const DOC_COMPONENTS: Record<
  string,
  React.LazyExoticComponent<React.ComponentType>
> = Object.fromEntries(
  manifest.files.map((file) => {
    const id = file.outputFile.split('/').pop()?.replace('.tsx', '') || ''
    return [id, React.lazy(() => import(`@/documentation/generated/${id}.tsx`))]
  })
)

const Keybindings = () => {
  const allKeybindings = getAllKeybindings()
  const commandShortcuts = getAllCommands().filter((cmd) => cmd.shortcut)

  return (
    <div>
      <h2 className="text-lg font-semibold mb-4">Keyboard Shortcuts</h2>
      <p>
        <ExternalLink
          className="mb-2"
          href="https://codemirror.net/docs/ref/#commands.emacsStyleKeymap"
        >
          Emacs-style keybindings are available for line editing
        </ExternalLink>
      </p>

      <h3 className="text-base font-semibold mb-2 mt-6">
        App and Editor Shortcuts
      </h3>
      <DescriptionList>
        {allKeybindings.map((keybinding) => (
          <React.Fragment key={keybinding.name}>
            <DescriptionTerm>{keybinding.description}</DescriptionTerm>
            <DescriptionDetails>
              <Badge>{displayKey(keybinding)}</Badge>
            </DescriptionDetails>
          </React.Fragment>
        ))}
      </DescriptionList>

      <h3 className="text-base font-semibold mb-2 mt-6">Outline Editing</h3>
      <DescriptionList>
        {[
          ['Enter', 'Split at the cursor; outdent an empty indented line'],
          ['Tab / Shift Tab', 'Indent / outdent the current line'],
          ['Enter / Tab (completion open)', 'Accept the selected suggestion'],
          ['↑ / ↓', 'Move to the previous / next line'],
          ['Backspace at start of line', 'Merge into the previous line'],
          [`${modName} Z`, 'Undo'],
          [`${modName} Shift Z / ${modName} Y`, 'Redo'],
        ].map(([key, description]) => (
          <React.Fragment key={key}>
            <DescriptionTerm>{description}</DescriptionTerm>
            <DescriptionDetails>
              <Badge>{key}</Badge>
            </DescriptionDetails>
          </React.Fragment>
        ))}
      </DescriptionList>

      <h3 className="text-base font-semibold mb-2 mt-6">
        Command Palette Shortcuts
      </h3>
      <p className="text-sm text-text-2 mb-2">
        Press{' '}
        <Badge className="inline">
          {displayKey(keybindings.commandPalette)}
        </Badge>{' '}
        to open the command palette, then press any of these keys:
      </p>
      <DescriptionList>
        {commandShortcuts.map((command) => (
          <React.Fragment key={command.id}>
            {command.subcommands?.length ? (
              // Command with subcommands - show parent and children
              <>
                <DescriptionTerm className="text-text-2">
                  {command.name}
                </DescriptionTerm>
                <DescriptionDetails>
                  <Badge>{command.displayShortcut || command.shortcut}</Badge>
                  <span className="text-muted ml-1">+ ...</span>
                </DescriptionDetails>
                {command.subcommands.map((sub) => (
                  <React.Fragment key={sub.key}>
                    <DescriptionTerm className="pl-4">
                      {sub.name}
                    </DescriptionTerm>
                    <DescriptionDetails>
                      <Badge>
                        {command.displayShortcut || command.shortcut}
                      </Badge>
                      <span className="text-muted mx-1">then</span>
                      <Badge>{sub.displayKey || sub.key.toUpperCase()}</Badge>
                    </DescriptionDetails>
                  </React.Fragment>
                ))}
              </>
            ) : (
              // Simple command without subcommands
              <>
                <DescriptionTerm>{command.name}</DescriptionTerm>
                <DescriptionDetails>
                  <Badge>{command.displayShortcut || command.shortcut}</Badge>
                </DescriptionDetails>
              </>
            )}
          </React.Fragment>
        ))}
      </DescriptionList>
    </div>
  )
}

const SyntaxHelp = () => {
  return (
    <div>
      <h2 className="text-lg font-semibold mb-4">Editor Syntax</h2>
      <p>
        Each line is an outline item. Use Tab and Shift Tab to nest lines; Enter
        creates a new line. Inline formatting supports a subset of Markdown.
      </p>
      <p className="mt-3 text-text-2">
        Headings start with one to three # characters followed by a space. Tags
        have no space after #, start with a letter, and can contain letters,
        numbers, hyphens, and slashes (for example #work/project). Internal
        links accept letters, numbers, spaces, and slashes.
      </p>
      <DescriptionList>
        <DescriptionTerm>Internal links</DescriptionTerm>
        <DescriptionDetails>
          <Badge>{`[[InternalLinks]]`}</Badge>
        </DescriptionDetails>
      </DescriptionList>

      <DescriptionList>
        <DescriptionTerm>Tags</DescriptionTerm>
        <DescriptionDetails>
          <Badge>{`#tag`}</Badge>
        </DescriptionDetails>
      </DescriptionList>

      <DescriptionList>
        <DescriptionTerm>Headers</DescriptionTerm>
        <DescriptionDetails className="flex flex-col gap-2">
          <div>
            <Badge>{`# Header`}</Badge>
          </div>
          <div>
            <Badge>{`## Header2`}</Badge>
          </div>
          <div>
            <Badge>{`### Header3`}</Badge>
          </div>
        </DescriptionDetails>
      </DescriptionList>
      <DescriptionList>
        <DescriptionTerm>External links</DescriptionTerm>
        <DescriptionDetails>
          <Badge>{`[link text](https://example.com)`}</Badge>
        </DescriptionDetails>
      </DescriptionList>

      <DescriptionList>
        <DescriptionTerm>Bold</DescriptionTerm>
        <DescriptionDetails>
          <Badge>{`**bold** or __bold__`}</Badge>
        </DescriptionDetails>
      </DescriptionList>

      <DescriptionList>
        <DescriptionTerm>Italic</DescriptionTerm>
        <DescriptionDetails>
          <Badge>{`_italic_ or *italic*`}</Badge>
        </DescriptionDetails>
      </DescriptionList>

      <DescriptionList>
        <DescriptionTerm>Strikethrough</DescriptionTerm>
        <DescriptionDetails>
          <Badge>{`~~strikethrough~~`}</Badge>
        </DescriptionDetails>
      </DescriptionList>
      <DescriptionList>
        <DescriptionTerm>Inline code</DescriptionTerm>
        <DescriptionDetails>
          <Badge>{`\`Inline code\``}</Badge>
        </DescriptionDetails>
      </DescriptionList>
    </div>
  )
}

export const Help = React.memo(() => {
  const [selectedPage, setSelectedPage] = useState<
    'syntax' | 'keybindings' | string
  >('getting-started')

  // Build navigation items
  const allItems = useMemo(() => {
    const helpItems = [
      { id: 'syntax', title: 'Editor Syntax', type: 'help' },
      { id: 'keybindings', title: 'Keyboard Shortcuts', type: 'help' },
      { id: 'commands', title: 'Commands', type: 'help' },
    ]

    const docItems = manifest.files.map((file) => {
      const filename =
        file.outputFile.split('/').pop()?.replace('.tsx', '') || ''
      return {
        id: filename,
        title: file.metadata.title || filename,
        type: 'doc',
      }
    })

    return [
      ...docItems.filter((item) => item.id === 'getting-started'),
      ...helpItems,
      ...docItems.filter((item) => item.id !== 'getting-started'),
    ]
  }, [])

  const renderContent = useCallback(() => {
    if (selectedPage === 'syntax') {
      return (
        <div className="p-4">
          <SyntaxHelp />
        </div>
      )
    }

    if (selectedPage === 'keybindings') {
      return (
        <div className="p-4">
          <Keybindings />
        </div>
      )
    }

    if (selectedPage === 'commands') return <CommandsHelp />

    // Render doc component
    const DocComponent = DOC_COMPONENTS[selectedPage]
    if (!DocComponent) {
      return <div className="p-4 text-accent">Unknown page</div>
    }
    return (
      <ErrorBoundary title="Error loading documentation">
        <React.Suspense fallback={<LoadingIndicator />}>
          <DocsWrapper>
            <DocComponent />
          </DocsWrapper>
        </React.Suspense>
      </ErrorBoundary>
    )
  }, [selectedPage])

  return (
    <div className="flex flex-col md:flex-row h-full min-h-0">
      <div className="border-b md:border-b-0 md:border-r border-raised p-4 shrink-0 md:w-56">
        <nav
          aria-label="Help topics"
          className="flex flex-wrap md:flex-col gap-2"
        >
          {allItems.map((item) => (
            <button
              type="button"
              key={item.id}
              aria-current={selectedPage === item.id ? 'page' : undefined}
              className={`rounded-md px-3 py-2 text-sm text-left transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${
                selectedPage === item.id
                  ? 'bg-raised text-text font-semibold ring-1 ring-inset ring-accent/40'
                  : 'text-text-2 hover:bg-raised hover:text-text'
              }`}
              onClick={() => setSelectedPage(item.id)}
            >
              {item.title}
            </button>
          ))}
        </nav>
      </div>

      <div
        key={selectedPage}
        className="flex-1 min-w-0 overflow-auto p-2 sm:p-6"
      >
        <div className="max-w-3xl mx-auto">{renderContent()}</div>
      </div>
    </div>
  )
})

const CommandsHelp = () => (
  <div className="p-4">
    <h2 className="text-lg font-semibold mb-4">Commands</h2>
    <p>
      Open the palette with {displayKey(keybindings.commandPalette)}. Press S or
      click the search field to search, use arrow keys to select, and Enter to
      run. Commands that change a line need a focused editor line.
    </p>
    <h3 className="text-base font-semibold mt-6 mb-2">Slash commands</h3>
    <p>
      Type / at the start of a line or after a space. Choose a suggestion with
      the arrow keys and accept it with Enter or Tab.
    </p>
    <DescriptionList>
      {[
        ['/stopwatch', 'Start timing the current line'],
        ['/countdown 25m', 'Start a countdown (25 minutes by default)'],
        ['/log 45m', 'Add logged time (45 minutes by default)'],
        ['/task', 'Add a task checkbox'],
        ['/pin', 'Pin the current line'],
        ['/date', 'Insert today’s date as YYYY-MM-DD'],
      ].map(([command, description]) => (
        <React.Fragment key={command}>
          <DescriptionTerm>
            <code>{command}</code>
          </DescriptionTerm>
          <DescriptionDetails>{description}</DescriptionDetails>
        </React.Fragment>
      ))}
    </DescriptionList>
    <p className="mt-3 text-text-2">
      Durations accept hours, minutes, and seconds, for example 1h 30m. Tasks,
      pins, and logged time are stored on the line; use commands or line
      controls to change them.
    </p>
    <h3 className="text-base font-semibold mt-6 mb-2">Command palette</h3>
    <DescriptionList>
      {getAllCommands().map((command) => (
        <React.Fragment key={command.id}>
          <DescriptionTerm>{command.name}</DescriptionTerm>
          <DescriptionDetails>
            <p>
              {command.description}
              {command.requiresEditor ? ' (Current line)' : ''}
            </p>
            {command.subcommands?.map((sub) => (
              <p key={sub.key} className="mt-2">
                <strong>{sub.name}:</strong> {sub.description}
              </p>
            ))}
          </DescriptionDetails>
        </React.Fragment>
      ))}
    </DescriptionList>
  </div>
)

export function HelpDialog() {
  const [open, setOpen] = useHelpOpen()
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent
        className="h-[90dvh] w-[94vw] max-w-6xl sm:max-w-6xl overflow-hidden rounded-xl border-raised p-0 gap-0 flex flex-col bg-page text-text"
        aria-describedby={undefined}
      >
        <div className="border-b border-raised px-6 py-5 shrink-0">
          <DialogTitle>Help</DialogTitle>
        </div>
        <Help />
        <footer className="border-t border-raised px-6 py-3 shrink-0">
          <Version />
        </footer>
      </DialogContent>
    </Dialog>
  )
}
