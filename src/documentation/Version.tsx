declare const TEKNE_GIT_INFO: { hash: string; message: string }

export function Version() {
  const { hash, message } = TEKNE_GIT_INFO

  return (
    <p className="flex items-center gap-2 min-w-0 text-xs text-text-2">
      <span className="shrink-0">Version</span>
      <code className="shrink-0 text-text" title={hash}>
        {hash.slice(0, 7)}
      </code>
      <span className="truncate" title={message}>
        {message}
      </span>
    </p>
  )
}
