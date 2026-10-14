import { Dialog, DialogContent, DialogTitle } from '@/components/vendor/Dialog'
import { useHelpOpen } from '@/hooks/panel-state'
import { LoadingIndicator } from '@/components/LoadingIndicator'
import React, { useState, useMemo, useCallback } from 'react'
import { displayKey, getAllKeybindings, keybindings, modName } from '@/lib/keys'
import { DocsWrapper } from '@/documentation/DocsWrapper'
import { Version } from '@/documentation/Version'
import manifest from '@/documentation/generated/manifest.json'
import { ExternalLink } from '@/components/ExternalLink'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import { getAllCommands } from '@/editor/command-registry'
import { cn } from '@/lib/utils'

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

const Keycap = ({ children }: { children: React.ReactNode }) => (
  <kbd className="inline-flex h-5 min-w-5 items-center justify-center rounded-[5px] bg-white/8 px-1.5 font-mono text-[11.5px] text-text shadow-[inset_0_-1px_0_rgba(0,0,0,0.45),0_0_0_0.5px_rgba(255,255,255,0.08)]">
    {children}
  </kbd>
)

/**
 * A combo as separate keycaps: 'Cmd Shift Z / Cmd Y' becomes two groups of
 * caps divided by a slash. Parts with a parenthetical stay as one cap.
 */
const Keys = ({ combo }: { combo: string }) => (
  <span className="inline-flex shrink-0 flex-wrap items-center justify-end gap-[3px] align-middle">
    {combo.split(' / ').map((alternative, i) => (
      <React.Fragment key={i}>
        {i > 0 && <span className="px-1 text-xs text-muted">/</span>}
        {(alternative.includes('(')
          ? [alternative]
          : alternative.split(' ')
        ).map((key, j) => (
          <Keycap key={j}>{key}</Keycap>
        ))}
      </React.Fragment>
    ))}
  </span>
)

const PageTitle = ({ children }: { children: React.ReactNode }) => (
  <h2 className="mb-4 text-[28px] font-bold tracking-[-0.015em]">{children}</h2>
)

const GroupTitle = ({ children }: { children: React.ReactNode }) => (
  <h3 className="mt-7 mb-1.5 text-[13px] font-semibold text-text">
    {children}
  </h3>
)

const Rows = ({ children }: { children: React.ReactNode }) => (
  <div className="-mx-2.5 flex flex-col">{children}</div>
)

const Row = ({
  label,
  children,
  className,
}: {
  label: React.ReactNode
  children: React.ReactNode
  className?: string
}) => (
  <div className="flex min-h-[34px] items-center gap-4 rounded-md px-2.5 py-1">
    <span className={cn('flex-1 text-sm text-text', className)}>{label}</span>
    {children}
  </div>
)

const Keybindings = () => {
  const allKeybindings = getAllKeybindings()
  const commandShortcuts = getAllCommands().filter((cmd) => cmd.shortcut)

  return (
    <div>
      <PageTitle>Keyboard Shortcuts</PageTitle>
      <p className="text-[15px] leading-6 text-text-2">
        <ExternalLink href="https://codemirror.net/docs/ref/#commands.emacsStyleKeymap">
          Emacs-style keybindings are available for line editing
        </ExternalLink>
      </p>

      <GroupTitle>App and Editor Shortcuts</GroupTitle>
      <Rows>
        {allKeybindings.map((keybinding) => (
          <Row key={keybinding.name} label={keybinding.description}>
            <Keys combo={displayKey(keybinding)} />
          </Row>
        ))}
      </Rows>

      <GroupTitle>Outline Editing</GroupTitle>
      <Rows>
        {[
          ['Enter', 'Split at the cursor; outdent an empty indented line'],
          ['Tab / Shift Tab', 'Indent / outdent the current line'],
          ['Enter / Tab (completion open)', 'Accept the selected suggestion'],
          ['↑ / ↓', 'Move to the previous / next line'],
          ['Backspace at start of line', 'Merge into the previous line'],
          [`${modName} Z`, 'Undo'],
          [`${modName} Shift Z / ${modName} Y`, 'Redo'],
        ].map(([key, description]) => (
          <Row key={key} label={description}>
            {key === 'Backspace at start of line' ? (
              <span className="flex items-center gap-1.5 text-xs text-muted">
                <Keycap>Backspace</Keycap>at start of line
              </span>
            ) : (
              <Keys combo={key} />
            )}
          </Row>
        ))}
      </Rows>

      <GroupTitle>Command Palette Shortcuts</GroupTitle>
      <p className="mb-2 text-[13px] leading-5 text-muted">
        Press <Keys combo={displayKey(keybindings.commandPalette)} /> to open
        the command palette, then press any of these keys:
      </p>
      <Rows>
        {commandShortcuts.map((command) => (
          <React.Fragment key={command.id}>
            {command.subcommands?.length ? (
              <>
                <Row label={command.name} className="text-text-2">
                  <span className="flex items-center gap-1">
                    <Keycap>
                      {command.displayShortcut || command.shortcut}
                    </Keycap>
                    <span className="text-xs text-muted">+ ...</span>
                  </span>
                </Row>
                {command.subcommands.map((sub) => (
                  <Row key={sub.key} label={sub.name} className="pl-4">
                    <span className="flex items-center gap-[3px]">
                      <Keycap>
                        {command.displayShortcut || command.shortcut}
                      </Keycap>
                      <span className="px-1 text-xs text-muted">then</span>
                      <Keycap>{sub.displayKey || sub.key.toUpperCase()}</Keycap>
                    </span>
                  </Row>
                ))}
              </>
            ) : (
              <Row label={command.name}>
                <Keycap>{command.displayShortcut || command.shortcut}</Keycap>
              </Row>
            )}
          </React.Fragment>
        ))}
      </Rows>
    </div>
  )
}

const SYNTAX: Array<[string, string[]]> = [
  ['Internal links', ['[[InternalLinks]]']],
  ['Tags', ['#tag']],
  ['Headers', ['# Header', '## Header2', '### Header3']],
  ['External links', ['[link text](https://example.com)']],
  ['Bold', ['**bold** or __bold__']],
  ['Italic', ['_italic_ or *italic*']],
  ['Strikethrough', ['~~strikethrough~~']],
  ['Inline code', ['`Inline code`']],
]

const SyntaxHelp = () => {
  return (
    <div>
      <PageTitle>Editor Syntax</PageTitle>
      <p className="text-[15px] leading-6 text-text-2">
        Each line is an outline item. Use Tab and Shift Tab to nest lines; Enter
        creates a new line. Inline formatting supports a subset of Markdown.
      </p>
      <p className="mt-3 text-[13px] leading-5 text-muted">
        Headings start with one to three # characters followed by a space. Tags
        have no space after #, start with a letter, and can contain letters,
        numbers, hyphens, and slashes (for example #work/project). Internal
        links accept letters, numbers, spaces, and slashes.
      </p>
      <dl className="mt-5 flex flex-col">
        {SYNTAX.map(([term, examples]) => (
          <div
            key={term}
            className="grid min-h-10 grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)] items-center gap-4 py-1.5 shadow-[0_-1px_0_rgba(255,255,255,0.05)]"
          >
            <dt className="text-sm text-text">{term}</dt>
            <dd className="flex flex-col gap-1">
              {examples.map((example) => (
                <code
                  key={example}
                  className="font-mono text-[13px] text-text-2"
                >
                  {example}
                </code>
              ))}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  )
}

export const Help = React.memo(() => {
  const [selectedPage, setSelectedPage] = useState<
    'syntax' | 'keybindings' | string
  >('getting-started')

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
    if (selectedPage === 'syntax') return <SyntaxHelp />
    if (selectedPage === 'keybindings') return <Keybindings />
    if (selectedPage === 'commands') return <CommandsHelp />

    const DocComponent = DOC_COMPONENTS[selectedPage]
    if (!DocComponent) {
      return <div className="text-accent">Unknown page</div>
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
    <div className="flex h-full min-h-0 w-full flex-col md:flex-row">
      <div className="flex shrink-0 flex-col gap-3 px-2.5 pt-4 pb-3 md:w-60">
        <DialogTitle className="px-2 text-[13px] font-semibold text-text">
          Help
        </DialogTitle>
        <nav
          aria-label="Help topics"
          className="flex flex-wrap gap-px md:flex-1 md:flex-col"
        >
          {allItems.map((item) => (
            <button
              type="button"
              key={item.id}
              aria-current={selectedPage === item.id ? 'page' : undefined}
              className={cn(
                'flex h-7 cursor-default items-center rounded-md px-2 text-left text-[13px] focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent',
                selectedPage === item.id
                  ? 'bg-accent-tint font-medium text-text'
                  : 'text-text-2 hover:bg-white/[0.045]'
              )}
              onClick={() => setSelectedPage(item.id)}
            >
              {item.title}
            </button>
          ))}
        </nav>
        <footer className="hidden px-2 md:block [&_p]:flex-wrap [&_p]:gap-x-1.5 [&_p]:gap-y-0.5 [&_p]:text-[11px] [&_p]:leading-4 [&_p]:text-muted [&_span.truncate]:basis-full">
          <Version />
        </footer>
      </div>

      <div
        key={selectedPage}
        className="min-w-0 flex-1 overflow-auto bg-page px-4 pt-12 pb-16 sm:px-8"
      >
        <div className="mx-auto max-w-[640px]">{renderContent()}</div>
      </div>
    </div>
  )
})

const CommandsHelp = () => (
  <div>
    <PageTitle>Commands</PageTitle>
    <p className="text-[15px] leading-6 text-text-2">
      Open the palette with {displayKey(keybindings.commandPalette)}. Press S or
      click the search field to search, use arrow keys to select, and Enter to
      run. Commands that change a line need a focused editor line.
    </p>
    <GroupTitle>Slash commands</GroupTitle>
    <p className="mb-2 text-[13px] leading-5 text-muted">
      Type / at the start of a line or after a space. Choose a suggestion with
      the arrow keys and accept it with Enter or Tab.
    </p>
    <Rows>
      {[
        ['/stopwatch', 'Start timing the current line'],
        ['/countdown 25m', 'Start a countdown (25 minutes by default)'],
        ['/log 45m', 'Add logged time (45 minutes by default)'],
        ['/task', 'Add a task checkbox'],
        ['/pin', 'Pin the current line'],
        ['/date', 'Insert today’s date as YYYY-MM-DD'],
      ].map(([command, description]) => (
        <div
          key={command}
          className="flex min-h-[34px] items-center gap-4 rounded-md px-2.5 py-1"
        >
          <code className="w-36 shrink-0 font-mono text-[13px] text-accent">
            {command}
          </code>
          <span className="flex-1 text-sm text-text-2">{description}</span>
        </div>
      ))}
    </Rows>
    <p className="mt-3 text-[13px] leading-5 text-muted">
      Durations accept hours, minutes, and seconds, for example 1h 30m. Tasks,
      pins, and logged time are stored on the line; use commands or line
      controls to change them.
    </p>
    <GroupTitle>Command palette</GroupTitle>
    <Rows>
      {getAllCommands().map((command) => (
        <div
          key={command.id}
          className="flex flex-col gap-0.5 rounded-md px-2.5 py-1.5"
        >
          <span className="text-sm text-text">{command.name}</span>
          <span className="text-[13px] leading-5 text-muted">
            {command.description}
            {command.requiresEditor ? ' (Current line)' : ''}
          </span>
          {command.subcommands?.map((sub) => (
            <p key={sub.key} className="mt-1 text-[13px] leading-5 text-muted">
              <strong className="font-medium text-text-2">{sub.name}:</strong>{' '}
              {sub.description}
            </p>
          ))}
        </div>
      ))}
    </Rows>
  </div>
)

export function HelpDialog() {
  const [open, setOpen] = useHelpOpen()
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent
        className="flex h-[90dvh] w-[94vw] max-w-[1080px] gap-0 overflow-hidden rounded-[14px] border-0 bg-panel p-0 text-text shadow-[0_0_0_0.5px_rgba(255,255,255,0.1),0_30px_80px_rgba(0,0,0,0.6)] sm:max-w-[1080px]"
        aria-describedby={undefined}
      >
        <Help />
      </DialogContent>
    </Dialog>
  )
}
