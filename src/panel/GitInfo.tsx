declare const TEKNE_GIT_INFO: { hash: string; message: string }

import { truncate } from 'lodash-es'

export function GitInfo() {
  const gitInfo = TEKNE_GIT_INFO
  const truncatedHash = gitInfo.hash.slice(0, 10)
  const truncatedMessage = truncate(gitInfo.message, { length: 80 })

  return (
    <div className="px-4 py-2 border-t border-zinc-800 text-xs text-zinc-500">
      <div className="font-mono">
        {truncatedHash} · {truncatedMessage}
      </div>
    </div>
  )
}
