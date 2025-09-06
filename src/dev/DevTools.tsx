import { useMemo, useState } from 'react'
import { useRouter } from '@tanstack/react-router'
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from '@/components/vendor/Tabs'
import { TanStackRouterDevtoolsPanel } from '@tanstack/react-router-devtools'
import { useAtom } from 'jotai'
import { zdoc } from '@/editor/schema'
import { extractDocData, treeifyDoc } from '@/editor/doc-analysis'
import { docAtom } from '@/editor/state'
import { Button } from '@/components/vendor/Button'
import { PgliteDevtools } from './PgliteDevtools'
import { getDocTitle } from '@/hooks/useDocTitle'
import { trpc } from '@/trpc/client'

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

  const pasteDocumentJSON = async () => {
    try {
      const text = await navigator.clipboard.readText()
      const parsedDoc = JSON.parse(text)

      // Validate the JSON structure
      const validatedDoc = zdoc.parse(parsedDoc)

      setDoc(validatedDoc)
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
      <div className="p-4 text-gray-500">
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
        <Button onClick={pasteDocumentJSON} outline>
          Paste JSON
        </Button>
        {message && (
          <span className="text-sm text-gray-600 dark:text-gray-400">
            {message}
          </span>
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
      <div className="p-4 text-gray-500">
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
    return extractDocData(treeifyDoc(doc))
  }, [doc])

  if (!isActive) {
    return <div className="p-4 text-gray-500">Document data will load when tab is active</div>
  }
  return <div className="whitespace-pre-wrap font-mono">{JSON.stringify(data, null, 2)}</div>
}

const DatabaseMigrations = ({ isActive }: { isActive: boolean }) => {
  const [shouldValidate, setShouldValidate] = useState(false)
  const [migrationResults, setMigrationResults] = useState<any>(null)

  const { data: validationResults, isLoading, error } = trpc.validateAllDocs.useQuery(undefined, {
    enabled: shouldValidate,
  })

  const migrateMutation = trpc.migrateAllDocs.useMutation({
    onSuccess: (data) => {
      setMigrationResults(data)
      // Trigger revalidation after migration
      setShouldValidate(false)
      setTimeout(() => setShouldValidate(true), 100)
    },
    onError: (error) => {
      setMigrationResults({ error: String(error) })
    }
  })

  const runValidation = () => {
    setShouldValidate(true)
  }

  const runMigration = () => {
    setMigrationResults(null)
    migrateMutation.mutate()
  }

  if (!isActive) {
    return (
      <div className="p-4 text-gray-500">
        Migration validation will load when tab is active
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-2 items-center">
        <Button
          onClick={runValidation}
          disabled={isLoading}
          outline
        >
          {isLoading ? 'Validating...' : 'Run Database Validation'}
        </Button>
        <Button
          onClick={runMigration}
          disabled={migrateMutation.isPending}
        >
          {migrateMutation.isPending ? 'Migrating...' : 'Apply Migrations'}
        </Button>
      </div>

      {error && (
        <div className="p-4 bg-red-50 dark:bg-red-900/20 rounded-lg">
          <h3 className="font-semibold text-red-800 dark:text-red-200 mb-2">
            Validation Error
          </h3>
          <p className="text-red-700 dark:text-red-300">{String(error)}</p>
        </div>
      )}

      {migrationResults && (
        <div className="space-y-4">
          {migrationResults.error ? (
            <div className="p-4 bg-red-50 dark:bg-red-900/20 rounded-lg">
              <h3 className="font-semibold text-red-800 dark:text-red-200 mb-2">
                Migration Error
              </h3>
              <p className="text-red-700 dark:text-red-300">{migrationResults.error}</p>
            </div>
          ) : (
            <>
              <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                <h3 className="font-semibold mb-2">Migration Results</h3>
                <div className="grid grid-cols-3 gap-4 text-sm">
                  <div>
                    <span className="text-gray-600 dark:text-gray-400">Total Documents:</span>
                    <br />
                    <span className="font-mono text-lg">{migrationResults.summary.totalDocs}</span>
                  </div>
                  <div>
                    <span className="text-blue-600 dark:text-blue-400">Migrated:</span>
                    <br />
                    <span className="font-mono text-lg text-blue-600 dark:text-blue-400">
                      {migrationResults.summary.migratedDocs}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-600 dark:text-gray-400">Unchanged:</span>
                    <br />
                    <span className="font-mono text-lg text-gray-600 dark:text-gray-400">
                      {migrationResults.summary.unchangedDocs}
                    </span>
                  </div>
                </div>
              </div>

              {migrationResults.reports.length > 0 && (
                <div>
                  <h3 className="font-semibold mb-3">Migration Details</h3>
                  <div className="space-y-3">
                    {migrationResults.reports.map((report: any, idx: number) => (
                      <div key={idx} className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                        <h4 className="font-semibold text-blue-800 dark:text-blue-200 mb-2">
                          {report.documentTitle}
                        </h4>
                        <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                          Schema version {report.originalVersion || 'undefined'} → {report.targetVersion}
                        </p>

                        <div>
                          <h5 className="text-sm font-medium text-blue-700 dark:text-blue-300 mb-1">
                            Operations performed:
                          </h5>
                          <ul className="text-sm text-blue-600 dark:text-blue-400 list-disc list-inside">
                            {report.operations.map((op: any, opIdx: number) => (
                              <li key={opIdx} className="font-mono">
                                <span className="font-bold">{op.type.toUpperCase()}</span> {op.path}: {op.description}
                              </li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {migrationResults.summary.migratedDocs === 0 && (
                <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
                  <h3 className="font-semibold text-green-800 dark:text-green-200 mb-2">
                    ✅ No Migrations Needed
                  </h3>
                  <p className="text-green-700 dark:text-green-300">
                    All documents are already up to date with the current schema.
                  </p>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {validationResults && (
        <div className="space-y-4">
          <>
            <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
              <h3 className="font-semibold mb-2">Validation Summary</h3>
              <div className="grid grid-cols-5 gap-4 text-sm">
                <div>
                  <span className="text-gray-600 dark:text-gray-400">Total:</span>
                  <br />
                  <span className="font-mono text-lg">{validationResults.summary.totalDocs}</span>
                </div>
                <div>
                  <span className="text-green-600 dark:text-green-400">Valid:</span>
                  <br />
                  <span className="font-mono text-lg text-green-600 dark:text-green-400">
                    {validationResults.summary.validDocs}
                  </span>
                </div>
                <div>
                  <span className="text-red-600 dark:text-red-400">Invalid:</span>
                  <br />
                  <span className="font-mono text-lg text-red-600 dark:text-red-400">
                    {validationResults.summary.invalidDocs}
                  </span>
                </div>
                <div>
                  <span className="text-blue-600 dark:text-blue-400">Fixable:</span>
                  <br />
                  <span className="font-mono text-lg text-blue-600 dark:text-blue-400">
                    {validationResults.summary.fixableByMigration || 0}
                  </span>
                </div>
                <div>
                  <span className="text-orange-600 dark:text-orange-400">Unfixable:</span>
                  <br />
                  <span className="font-mono text-lg text-orange-600 dark:text-orange-400">
                    {validationResults.summary.unfixable || 0}
                  </span>
                </div>
              </div>
            </div>

            {validationResults.results.length > 0 && (
              <div>
                <h3 className="font-semibold mb-3">Problematic Documents</h3>
                <div className="space-y-3">
                  {validationResults.results.map((result: any, idx: number) => {
                    const bgColor = result.canBeFxedByMigration 
                      ? "bg-blue-50 dark:bg-blue-900/20" 
                      : "bg-red-50 dark:bg-red-900/20"
                    const textColor = result.canBeFxedByMigration 
                      ? "text-blue-800 dark:text-blue-200" 
                      : "text-red-800 dark:text-red-200"
                    const subTextColor = result.canBeFxedByMigration 
                      ? "text-blue-700 dark:text-blue-300" 
                      : "text-red-700 dark:text-red-300"
                    const listTextColor = result.canBeFxedByMigration 
                      ? "text-blue-600 dark:text-blue-400" 
                      : "text-red-600 dark:text-red-400"

                    return (
                      <div key={idx} className={`p-3 rounded-lg ${bgColor}`}>
                        <div className="flex items-center justify-between mb-2">
                          <h4 className={`font-semibold ${textColor}`}>
                            {result.title}
                          </h4>
                          <div className="flex items-center gap-2">
                            {result.canBeFxedByMigration ? (
                              <span className="px-2 py-1 text-xs bg-blue-100 text-blue-800 dark:bg-blue-800 dark:text-blue-100 rounded-full">
                                ✅ Fixable by Migration
                              </span>
                            ) : (
                              <span className="px-2 py-1 text-xs bg-red-100 text-red-800 dark:bg-red-800 dark:text-red-100 rounded-full">
                                ❌ Manual Fix Required
                              </span>
                            )}
                          </div>
                        </div>
                        
                        {result.errors.length > 0 && (
                          <div className="mb-2">
                            <h5 className={`text-sm font-medium ${subTextColor} mb-1`}>
                              Validation Errors:
                            </h5>
                            <ul className={`text-sm ${listTextColor} list-disc list-inside`}>
                              {result.errors.map((error: string, errorIdx: number) => (
                                <li key={errorIdx} className="font-mono">{error}</li>
                              ))}
                            </ul>
                          </div>
                        )}

                        {result.extraFields.length > 0 && (
                          <div className="mb-2">
                            <h5 className={`text-sm font-medium ${subTextColor} mb-1`}>
                              Extra Fields (not in schema):
                            </h5>
                            <ul className={`text-sm ${listTextColor} list-disc list-inside`}>
                              {result.extraFields.map((field: string, fieldIdx: number) => (
                                <li key={fieldIdx} className="font-mono">{field}</li>
                              ))}
                            </ul>
                          </div>
                        )}

                        {result.canBeFxedByMigration && result.migrationReport && (
                          <div className="mt-2 pt-2 border-t border-blue-200 dark:border-blue-700">
                            <h5 className={`text-sm font-medium ${subTextColor} mb-1`}>
                              Migration Preview:
                            </h5>
                            <ul className={`text-sm ${listTextColor} list-disc list-inside`}>
                              {result.migrationReport.operations.map((op: any, opIdx: number) => (
                                <li key={opIdx} className="font-mono text-xs">
                                  <span className="font-bold">{op.type.toUpperCase()}</span> {op.path}: {op.description}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {validationResults.summary.invalidDocs === 0 && (
              <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
                <h3 className="font-semibold text-green-800 dark:text-green-200 mb-2">
                  ✅ All Documents Valid
                </h3>
                <p className="text-green-700 dark:text-green-300">
                  All documents in the database comply with the current schema.
                </p>
              </div>
            )}
          </>
        </div>
      )}
    </div>
  )
}

export const DevTools = () => {
  const usingPglite = !!window.dbHandle
  const [activeTab, setActiveTab] = useState('raw')

  const router = useRouter()
  return (
    <Tabs value={activeTab} onValueChange={setActiveTab}>
      <TabsList>
        <TabsTrigger value="raw">Document Content</TabsTrigger>
        <TabsTrigger value="tree">Tree Document</TabsTrigger>
        <TabsTrigger value="data">Document Data</TabsTrigger>
        <TabsTrigger value="migrations">Migrations</TabsTrigger>
        <TabsTrigger value="tanstackdev">TanStack</TabsTrigger>
        {usingPglite && <TabsTrigger value="pglite">pglite</TabsTrigger>}
      </TabsList>
      <TabsContent value="raw">
        <RawDocument isActive={activeTab === 'raw'} />
      </TabsContent>
      <TabsContent value="tree">
        <TreeDocument isActive={activeTab === 'tree'} />
      </TabsContent>
      <TabsContent value="data">
        <DocumentData isActive={activeTab === 'data'} />
      </TabsContent>
      <TabsContent value="migrations">
        <DatabaseMigrations isActive={activeTab === 'migrations'} />
      </TabsContent>
      {usingPglite && (
        <TabsContent value="pglite">
          <PgliteDevtools />
        </TabsContent>
      )}
      <TabsContent value="tanstackdev">
        <TanStackRouterDevtoolsPanel router={router} />
      </TabsContent>
    </Tabs>
  )
}
