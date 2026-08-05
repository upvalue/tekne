import { Circle, CircleDot, Pin } from 'lucide-react'

/**
 * The bullet glyph at the start of a line: pin > collapse marker > dot.
 * Shared by the editable ELine and the read-only search-result line.
 */
export const LineGlyph = ({
  pinned,
  collapseStart = false,
  className,
}: {
  pinned: boolean
  collapseStart?: boolean
  className?: string
}) => {
  if (pinned) {
    return <Pin width={8} height={8} className={className} />
  }
  if (collapseStart) {
    return <CircleDot width={8} height={8} className={className} />
  }
  return <Circle width={8} height={8} className={className} />
}
