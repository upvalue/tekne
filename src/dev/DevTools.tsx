import { Tooltip } from '@/components/vendor/Tooltip'
import { AppearancePreview } from './AppearancePreview'
import { LoadingIndicator } from '@/components/LoadingIndicator'
import { lazy, Suspense, useMemo, useState } from 'react'
import { useRouter } from '@tanstack/react-router'
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from '@/components/vendor/Tabs'
import { TanStackRouterDevtoolsPanel } from '@tanstack/react-router-devtools'
import { useAtom } from 'jotai'
import { zdoc, copyLines } from '@/docs/schema'
import { extractDocData, treeifyDoc } from '@/docs/doc-analysis'
import { docAtom } from '@/editor/state'
import { Button } from '@/components/vendor/Button'

// PGlite only exists in the development in-memory mode, so this panel — and
// with it the pglite wasm and the REPL — is compiled out of production
// builds rather than merely split into a chunk nothing ever fetches.
const PgliteDevtools = import.meta.env.PROD
  ? null
  : lazy(() =>
      import('./PgliteDevtools').then((m) => ({ default: m.PgliteDevtools }))
    )

// The migration/recompute panel drives whole-database rewrites
// (doc.migrateAllDocs, doc.recomputeAllData); like the PGlite tools it is
// compiled out of production builds rather than left one click away.
const DatabaseMigrations = import.meta.env.PROD
  ? null
  : lazy(() =>
      import('./DatabaseMigrations').then((m) => ({
        default: m.DatabaseMigrations,
      }))
    )

const RawDocument = ({ isActive }: { isActive: boolean }) => {
  const [doc, setDoc] = useAtom(docAtom)
  const [message, setMessage] = useState<string>('')

  const copyDocumentJSON = async () => {
    try {
      await navigator.clipboard.writeText(JSON.stringify(doc, null, 2))
      setMessage('Document JSON copied to clipboard!')
      setTimeout(() => setMessage(''), 2000)
    } catch {
      setMessage('Failed to copy to clipboard')
      setTimeout(() => setMessage(''), 2000)
    }
  }

  const pasteDocumentJSON = async (asCopy = false) => {
    try {
      const text = await navigator.clipboard.readText()
      const parsedDoc = JSON.parse(text)

      // Validate the JSON structure
      const validatedDoc = zdoc.parse(parsedDoc)

      setDoc(
        asCopy
          ? { ...validatedDoc, children: copyLines(validatedDoc.children) }
          : validatedDoc
      )
      setMessage('Document JSON pasted and applied!')
      setTimeout(() => setMessage(''), 2000)
    } catch (error) {
      if (error instanceof SyntaxError) {
        setMessage('Invalid JSON format')
      } else {
        setMessage('Invalid document structure')
      }
      setTimeout(() => setMessage(''), 3000)
    }
  }

  if (!isActive) {
    return (
      <div className="p-4 text-muted">
        Document content will load when tab is active
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-2 items-center">
        <Button onClick={copyDocumentJSON} outline>
          Copy JSON
        </Button>
        <Button onClick={() => pasteDocumentJSON()} outline>
          Paste JSON
        </Button>
        <Button onClick={() => pasteDocumentJSON(true)} outline>
          Paste JSON as copy
        </Button>
        {message && (
          <span className="text-sm text-muted dark:text-text-2">{message}</span>
        )}
      </div>
      <div className="whitespace-pre-wrap font-mono">
        {JSON.stringify(doc, null, 2)}
      </div>
    </div>
  )
}

const TreeDocument = ({ isActive }: { isActive: boolean }) => {
  const [doc] = useAtom(docAtom)

  if (!isActive) {
    return (
      <div className="p-4 text-muted">
        Tree document will load when tab is active
      </div>
    )
  }

  return (
    <div className="whitespace-pre-wrap font-mono">
      {JSON.stringify(treeifyDoc(doc), null, 2)}
    </div>
  )
}

const DocumentData = ({ isActive }: { isActive: boolean }) => {
  const [doc] = useAtom(docAtom)

  const data = useMemo(() => {
    return extractDocData(treeifyDoc(doc).children)
  }, [doc])

  if (!isActive) {
    return (
      <div className="p-4 text-muted">
        Document data will load when tab is active
      </div>
    )
  }
  return (
    <div className="whitespace-pre-wrap font-mono">
      {JSON.stringify(data, null, 2)}
    </div>
  )
}

const DocumentInspector = () => {
  const [mode, setMode] = useState('raw')
  return (
    <Tabs value={mode} onValueChange={setMode}>
      <TabsList aria-label="Document mode">
        <Tooltip
          label="Content"
          description="The editor’s document JSON, including line IDs, text, and recorded values. Copy it for inspection. Pasting replaces the current document; paste as copy assigns new line IDs."
        >
          <TabsTrigger value="raw">Content</TabsTrigger>
        </Tooltip>
        <Tooltip
          label="Tree"
          description="Lines arranged into parent and child groups using indentation, with inherited tags. Use this to inspect outline structure."
        >
          <TabsTrigger value="tree">Tree</TabsTrigger>
        </Tooltip>
        <Tooltip
          label="Data"
          description="Structured records extracted from the outline for search and summaries, including tags, task status, and time."
        >
          <TabsTrigger value="data">Data</TabsTrigger>
        </Tooltip>
      </TabsList>
      <TabsContent value="raw" className="space-y-4">
        <RawDocument isActive={mode === 'raw'} />
      </TabsContent>
      <TabsContent value="tree" className="space-y-4">
        <TreeDocument isActive={mode === 'tree'} />
      </TabsContent>
      <TabsContent value="data" className="space-y-4">
        <DocumentData isActive={mode === 'data'} />
      </TabsContent>
    </Tabs>
  )
}

export const DevTools = () => {
  const usingPglite = PgliteDevtools !== null && !!window.dbHandle
  const [activeTab, setActiveTab] = useState('document')

  const router = useRouter()
  return (
    <Tabs value={activeTab} onValueChange={setActiveTab}>
      <TabsList aria-label="Developer tools">
        <Tooltip
          label="Appearance &amp; errors"
          description="Try sample error states and the notification history."
        >
          <TabsTrigger value="appearance">Appearance & errors</TabsTrigger>
        </Tooltip>
        <Tooltip
          label="Document"
          description="Inspect the current document as editor content, an outline tree, or extracted data."
        >
          <TabsTrigger value="document">Document</TabsTrigger>
        </Tooltip>
        {DatabaseMigrations && (
          <Tooltip
            label="Migrations"
            description="Run document migrations or rebuild extracted data across the database."
          >
            <TabsTrigger value="migrations">Migrations</TabsTrigger>
          </Tooltip>
        )}
        <Tooltip
          label="TanStack"
          description="Inspect the current route, parameters, and router state."
        >
          <TabsTrigger value="tanstackdev">TanStack</TabsTrigger>
        </Tooltip>
        {usingPglite && (
          <Tooltip
            label="pglite"
            description="Query the local development database with SQL."
          >
            <TabsTrigger value="pglite">pglite</TabsTrigger>
          </Tooltip>
        )}
      </TabsList>
      <TabsContent value="appearance">
        <AppearancePreview />
      </TabsContent>
      <TabsContent value="document">
        <DocumentInspector />
      </TabsContent>
      {DatabaseMigrations && (
        <TabsContent value="migrations">
          <Suspense fallback={<LoadingIndicator />}>
            <DatabaseMigrations isActive={activeTab === 'migrations'} />
          </Suspense>
        </TabsContent>
      )}
      {usingPglite && PgliteDevtools && (
        <TabsContent value="pglite">
          <Suspense fallback={<LoadingIndicator />}>
            <PgliteDevtools />
          </Suspense>
        </TabsContent>
      )}
      <TabsContent value="tanstackdev">
        <TanStackRouterDevtoolsPanel router={router} />
      </TabsContent>
    </Tabs>
  )
}
