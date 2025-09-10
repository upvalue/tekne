import React, { useState, useMemo, useCallback } from 'react'
import { Badge } from '@/components/vendor/Badge'
import {
  DescriptionDetails,
  DescriptionList,
  DescriptionTerm,
} from '@/components/vendor/DescriptionList'
import { getAllKeybindings } from '@/lib/keys'
import { LinkIcon } from '@heroicons/react/16/solid'
import { DocsWrapper } from '@/docs/DocsWrapper'
import { Button } from '@/components/vendor/Button'
import { Version } from '@/docs/Version'
import manifest from '@/docs/manifest.json'
import { ExternalLink } from '@/components/ExternalLink'
const Keybindings = () => {
  const allKeybindings = getAllKeybindings()

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
      <DescriptionList>
        {allKeybindings.map((keybinding) => (
          <React.Fragment key={keybinding.name}>
            <DescriptionTerm>{keybinding.description}</DescriptionTerm>
            <DescriptionDetails>
              <Badge>{keybinding.displayKey}</Badge>
            </DescriptionDetails>
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
      <p>Editor syntax is a mix of customizations and a subset of Markdown.</p>
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
        <DescriptionTerm>External links</DescriptionTerm>
        <DescriptionDetails>
          <Badge>{`[link text](https://example.com)`}</Badge>
        </DescriptionDetails>
      </DescriptionList>

      <DescriptionList>
        <DescriptionTerm>Bold</DescriptionTerm>
        <DescriptionDetails>
          <Badge>{`**bold**`}</Badge>
        </DescriptionDetails>
      </DescriptionList>

      <DescriptionList>
        <DescriptionTerm>Italic</DescriptionTerm>
        <DescriptionDetails>
          <Badge>{`_italic_`}</Badge>
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
      { id: 'version', title: 'Version', type: 'version' },
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

    return [...helpItems, ...docItems].sort((a, b) =>
      a.title.localeCompare(b.title)
    )
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

    if (selectedPage === 'version') {
      return <Version />
    }

    // Render doc component
    try {
      const DocComponent = React.lazy(
        () => import(`@/docs/${selectedPage}.tsx`)
      )
      return (
        <React.Suspense fallback={<div className="p-4">Loading...</div>}>
          <DocsWrapper>
            <DocComponent />
          </DocsWrapper>
        </React.Suspense>
      )
    } catch (error) {
      return <div className="p-4 text-red-400">Error loading documentation</div>
    }
  }, [selectedPage])

  return (
    <div className="flex flex-col h-full">
      <div className="border-b border-zinc-800 p-4 flex-shrink-0">
        <div className="flex flex-wrap gap-2">
          {allItems.map((item) => (
            <Button
              key={item.id}
              {...(selectedPage === item.id
                ? { color: 'zinc' }
                : { plain: true })}
              onClick={() => setSelectedPage(item.id)}
            >
              {item.title}
            </Button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-auto">{renderContent()}</div>
    </div>
  )
})
