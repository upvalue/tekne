import { trpc } from '@/trpc/client'
import { modName } from '@/lib/keys'

const KNOWN_FLAGS = [
  { key: 'document_undo', label: 'Document Undo', description: `Enable document-level undo/redo (${modName}+Z / ${modName}+Shift+Z)` },
]

export function FeatureFlags({ isActive }: { isActive: boolean }) {
  const flagsQuery = trpc.flags.getAll.useQuery(undefined, { enabled: isActive })
  const setFlagMutation = trpc.flags.set.useMutation()
  const utils = trpc.useUtils()

  const flags = flagsQuery.data ?? {}

  const handleToggle = async (key: string, currentValue: boolean) => {
    await setFlagMutation.mutateAsync({ key, value: !currentValue })
    utils.flags.getAll.invalidate()
  }

  if (!isActive) {
    return <div className="p-4 text-gray-500">Feature flags will load when tab is active</div>
  }

  if (flagsQuery.isLoading) {
    return <div className="p-4 text-gray-500">Loading flags...</div>
  }

  return (
    <div className="space-y-3">
      {KNOWN_FLAGS.map((flag) => {
        const value = !!flags[flag.key]
        return (
          <div
            key={flag.key}
            className="flex justify-between items-center p-3 border border-zinc-700 rounded-lg"
          >
            <div>
              <div className="font-bold text-sm">{flag.label}</div>
              <div className="text-xs text-zinc-500">{flag.description}</div>
            </div>
            <button
              onClick={() => handleToggle(flag.key, value)}
              disabled={setFlagMutation.isPending}
              className={`px-3 py-1 rounded text-sm font-bold min-w-[50px] border-none cursor-pointer ${
                value
                  ? 'bg-green-400 text-black'
                  : 'bg-zinc-600 text-white'
              }`}
            >
              {value ? 'ON' : 'OFF'}
            </button>
          </div>
        )
      })}
    </div>
  )
}
