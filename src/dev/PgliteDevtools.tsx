import { dbMemory, DB_PATH_KEY, DEFAULT_DB_PATH } from '@/db'
import type { PGlite } from '@electric-sql/pglite'
import { Repl } from '@electric-sql/pglite-repl'
import { useEffect, useRef, useState, type RefObject } from 'react'
import { Button } from '@/components/vendor/Button'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/vendor/Dialog'
import { Input } from '@/components/vendor/Input'

interface PgliteDatabase {
  name: string
  path: string
  version: number
}

const listPgliteDatabases = async (): Promise<PgliteDatabase[]> => {
  const databases = await indexedDB.databases()
  return databases
    .filter(
      (db): db is IDBDatabaseInfo & { name: string } =>
        typeof db.name === 'string' && db.name.startsWith('/pglite')
    )
    .map((db) => ({
      name: db.name.replace('/pglite/', ''),
      path: db.name.replace('/pglite/', ''),
      version: db.version || 1,
    }))
}

const getCurrentDatabasePath = (): string => {
  return window.localStorage.getItem(DB_PATH_KEY) || DEFAULT_DB_PATH
}

const setDatabasePath = (path: string) => {
  window.localStorage.setItem(DB_PATH_KEY, path)
}

const createNewDatabase = async (name: string): Promise<void> => {
  // Opening (and immediately closing) a PGlite instance is what creates the
  // backing IndexedDB store; there is no separate "create" API.
  const { PGlite } = await import('@electric-sql/pglite')
  const testDb = new PGlite(`idb://${name}`)
  await testDb.close()
}

// IndexedDB helper functions
const openIndexedDB = (dbName: string): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(dbName)
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

const getAllFromObjectStore = (
  db: IDBDatabase,
  storeName: string
): Promise<unknown[]> => {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([storeName], 'readonly')
    const objectStore = transaction.objectStore(storeName)
    const request = objectStore.getAll()

    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

const createDatabaseWithData = (
  dbName: string,
  version: number,
  data: unknown[]
): Promise<boolean> => {
  return new Promise((resolve, reject) => {
    // Delete existing database first
    const deleteRequest = indexedDB.deleteDatabase(dbName)

    deleteRequest.onsuccess = () => {
      const openRequest = indexedDB.open(dbName, version)

      openRequest.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result

        // Create FILE_DATA object store with timestamp index
        const objectStore = db.createObjectStore('FILE_DATA')
        objectStore.createIndex('timestamp', 'timestamp', { unique: false })
      }

      openRequest.onsuccess = () => {
        const db = openRequest.result
        const transaction = db.transaction(['FILE_DATA'], 'readwrite')
        const objectStore = transaction.objectStore('FILE_DATA')

        // Add all data
        data.forEach((item, index) => {
          objectStore.add(item, index)
        })

        transaction.oncomplete = () => {
          db.close()
          resolve(true)
        }

        transaction.onerror = () => {
          db.close()
          reject(transaction.error)
        }
      }

      openRequest.onerror = () => reject(openRequest.error)
    }

    deleteRequest.onerror = () => reject(deleteRequest.error)
  })
}

/** Copy a PGlite database at the IndexedDB level. Throws on failure. */
const copyDatabase = async (
  sourceName: string,
  destinationName: string
): Promise<void> => {
  const sourceDbName = `/pglite/${sourceName}`
  const destDbName = `/pglite/${destinationName}`

  // Check if source database exists
  const databases = await indexedDB.databases()
  const sourceExists = databases.some((db) => db.name === sourceDbName)
  if (!sourceExists) {
    throw new Error(`Source database ${sourceDbName} does not exist`)
  }

  const sourceDb = await openIndexedDB(sourceDbName)
  const sourceVersion = sourceDb.version

  // Get all data from FILE_DATA object store
  const allData = await getAllFromObjectStore(sourceDb, 'FILE_DATA')
  sourceDb.close()

  // Create destination database with same structure and data (an existing
  // destination is overwritten)
  await createDatabaseWithData(destDbName, sourceVersion, allData)
}

/** Turn a database-management failure into a message the dialog can show. */
const describeError = (error: unknown): string => {
  if (error instanceof Error) {
    if (error.name === 'QuotaExceededError') {
      return `${error.message} — not enough storage space to complete the copy`
    }
    if (error.name === 'InvalidStateError') {
      return `${error.message} — the database might be in use, try again in a moment`
    }
    return error.message
  }
  return String(error)
}

export const PgliteRepl = () => {
  const dbHandleRef: RefObject<PGlite | null> = useRef(null)
  const [haveDb, setHaveDb] = useState(false)
  useEffect(() => {
    dbMemory().then(({ dbHandle }) => {
      dbHandleRef.current = dbHandle
      setHaveDb(true)
    })
  }, [])

  return (
    <div>
      {haveDb && dbHandleRef.current && <Repl pg={dbHandleRef.current} />}
    </div>
  )
}

export const PgliteDevtools = () => {
  const [databases, setDatabases] = useState<PgliteDatabase[]>([])
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [newDbName, setNewDbName] = useState('')
  const [copySourceName, setCopySourceName] = useState('')
  const [copyDestName, setCopyDestName] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [currentDbPath, setCurrentDbPath] = useState('')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  useEffect(() => {
    setCurrentDbPath(getCurrentDatabasePath())
    loadDatabases()
  }, [])

  const loadDatabases = async () => {
    try {
      setDatabases(await listPgliteDatabases())
    } catch (error) {
      setErrorMessage(describeError(error))
    }
  }

  const handleCreateNewDatabase = async () => {
    if (!newDbName.trim()) return

    setIsLoading(true)
    setErrorMessage(null)
    try {
      await createNewDatabase(newDbName)
      await loadDatabases()
      setNewDbName('')
    } catch (error) {
      setErrorMessage(describeError(error))
    }
    setIsLoading(false)
  }

  const handleCopyDatabase = async () => {
    if (!copySourceName || !copyDestName.trim()) return

    setIsLoading(true)
    setErrorMessage(null)
    try {
      await copyDatabase(copySourceName, copyDestName)
      await loadDatabases()
      setCopySourceName('')
      setCopyDestName('')
    } catch (error) {
      setErrorMessage(describeError(error))
    }
    setIsLoading(false)
  }

  const handleLoadDatabase = (name: string) => {
    setDatabasePath(name)
    setCurrentDbPath(name)
    setIsDialogOpen(false)
    window.location.reload()
  }

  return (
    <div>
      <div className="mb-4 p-4 bg-zinc-50 dark:bg-zinc-900 rounded-lg  ">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-medium mb-1">Current Database</h3>
            <code className="text-xs text-zinc-600 dark:text-zinc-400">
              {currentDbPath}
            </code>
          </div>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button outline>Manage Databases</Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Database Management</DialogTitle>
                <DialogDescription>
                  Select, create, or copy PGlite databases. Changes will reload
                  the page.
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-6">
                {errorMessage && (
                  <div className="p-3 bg-red-900/20 border border-red-800 rounded-lg text-sm text-red-300">
                    {errorMessage}
                  </div>
                )}

                {/* Available Databases */}
                <div>
                  <h4 className="text-sm font-medium mb-3">
                    Available Databases
                  </h4>
                  {databases.length > 0 ? (
                    <div className="space-y-2 overflow-y-scroll">
                      {databases.map((db) => (
                        <div
                          key={db.path}
                          className="flex items-center justify-between p-3 border rounded-lg"
                        >
                          <div className="flex-1">
                            <div className="text-sm font-medium text-white">
                              {db.name}
                            </div>
                            <div className="text-xs text-zinc-500">
                              Version {db.version}
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <Button
                              onClick={() => handleLoadDatabase(db.name)}
                              color="blue"
                              className="text-xs px-3 py-1"
                              disabled={isLoading}
                            >
                              Load
                            </Button>
                            <Button
                              onClick={() => setCopySourceName(db.name)}
                              outline
                              className="text-xs px-3 py-1"
                              disabled={isLoading}
                            >
                              Copy
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-zinc-500 py-4">
                      No databases found
                    </p>
                  )}
                </div>

                {/* Create New Database */}
                <div>
                  <h4 className="text-sm font-medium mb-3">
                    Create New Database
                  </h4>
                  <div className="flex gap-2">
                    <Input
                      value={newDbName}
                      onChange={(e) => setNewDbName(e.target.value)}
                      placeholder="Enter database name"
                      disabled={isLoading}
                    />
                    <Button
                      onClick={handleCreateNewDatabase}
                      disabled={!newDbName.trim() || isLoading}
                      color="green"
                    >
                      Create
                    </Button>
                  </div>
                </div>

                {/* Copy Database */}
                {copySourceName && (
                  <div>
                    <h4 className="text-sm font-medium mb-3">Copy Database</h4>
                    <div className="space-y-2">
                      <div className="text-xs text-zinc-600 dark:text-zinc-400">
                        Source: {copySourceName}
                      </div>
                      <div className="flex gap-2">
                        <Input
                          value={copyDestName}
                          onChange={(e) => setCopyDestName(e.target.value)}
                          placeholder="Enter new database name"
                          disabled={isLoading}
                        />
                        <Button
                          onClick={handleCopyDatabase}
                          disabled={!copyDestName.trim() || isLoading}
                          color="blue"
                        >
                          Copy
                        </Button>
                        <Button
                          onClick={() => {
                            setCopySourceName('')
                            setCopyDestName('')
                          }}
                          outline
                          disabled={isLoading}
                        >
                          Cancel
                        </Button>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <DialogFooter>
                <DialogClose asChild>
                  <Button outline disabled={isLoading}>
                    Close
                  </Button>
                </DialogClose>
                <Button onClick={loadDatabases} disabled={isLoading}>
                  {isLoading ? 'Loading...' : 'Refresh'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <PgliteRepl />
    </div>
  )
}
