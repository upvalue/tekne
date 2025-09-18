import { useState } from 'react'
import { Button } from '@/components/vendor/Button'
import { trpc } from '@/trpc/client'
import type { MigrateAllDocsOutput, RecomputeAllDataOutput } from '@/trpc/types'

export const DatabaseMigrations = ({ isActive }: { isActive: boolean }) => {
  const [shouldValidate, setShouldValidate] = useState(false)
  const [migrationResults, setMigrationResults] = useState<MigrateAllDocsOutput | { error: string } | null>(null)
  const [recomputeResults, setRecomputeResults] = useState<RecomputeAllDataOutput | { error: string } | null>(null)

  const { data: validationResults, isLoading, error } = trpc.doc.validateAllDocs.useQuery(undefined, {
    enabled: shouldValidate,
  })

  const migrateMutation = trpc.doc.migrateAllDocs.useMutation({
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

  const recomputeMutation = trpc.doc.recomputeAllData.useMutation({
    onSuccess: (data) => {
      setRecomputeResults(data)
    },
    onError: (error) => {
      setRecomputeResults({ error: String(error) })
    }
  })

  const runValidation = () => {
    setShouldValidate(true)
  }

  const runMigration = () => {
    setMigrationResults(null)
    migrateMutation.mutate()
  }

  const runRecompute = () => {
    setRecomputeResults(null)
    recomputeMutation.mutate()
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
        <Button
          onClick={runRecompute}
          disabled={recomputeMutation.isPending}
          outline
        >
          {recomputeMutation.isPending ? 'Recomputing...' : 'Recompute Data'}
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

      {recomputeResults && (
        <div className="space-y-4">
          {'error' in recomputeResults ? (
            <div className="p-4 bg-red-50 dark:bg-red-900/20 rounded-lg">
              <h3 className="font-semibold text-red-800 dark:text-red-200 mb-2">
                Recompute Error
              </h3>
              <p className="text-red-700 dark:text-red-300">{recomputeResults.error}</p>
            </div>
          ) : (
            <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
              <h3 className="font-semibold text-green-800 dark:text-green-200 mb-2">
                ✅ Data Recompute Complete
              </h3>
              <div className="grid grid-cols-3 gap-4 text-sm">
                <div>
                  <span className="text-gray-600 dark:text-gray-400">Total Documents:</span>
                  <br />
                  <span className="font-mono text-lg">{recomputeResults.totalDocs}</span>
                </div>
                <div>
                  <span className="text-green-600 dark:text-green-400">Processed:</span>
                  <br />
                  <span className="font-mono text-lg text-green-600 dark:text-green-400">
                    {recomputeResults.processedDocs}
                  </span>
                </div>
                <div>
                  <span className="text-blue-600 dark:text-blue-400">Data Rows:</span>
                  <br />
                  <span className="font-mono text-lg text-blue-600 dark:text-blue-400">
                    {recomputeResults.totalDataRows}
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {migrationResults && (
        <div className="space-y-4">
          {'error' in migrationResults ? (
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
                    {migrationResults.reports.map((report, idx: number) => (
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
                            {report.operations.map((op, opIdx: number) => (
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
                  {validationResults.results.map((result, idx: number) => {
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
                              {result.errors.map((error, errorIdx: number) => (
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
                              {result.extraFields.map((field, fieldIdx: number) => (
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
                              {result.migrationReport.operations.map((op, opIdx: number) => (
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