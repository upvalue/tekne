import { useMemo } from 'react'
import type { RouterOutputs } from '@/trpc/types'
import type { ProposedDocumentEdits, ProposedLineChange } from '@/docs/doc-diff'
import { DocumentEditsReview } from '@/panel/diff/DocumentEditsReview'

type Proposal = RouterOutputs['tags']['renamePropose']

/** A tag rename only ever rewrites lines in place -- every row is 'changed'. */
const toChanges = (doc: Proposal['docs'][number]): ProposedLineChange[] =>
  doc.lines.map((line) => ({
    kind: 'changed',
    before: {
      mdContent: line.before,
      indent: line.indent,
      datumTaskStatus: line.datumTaskStatus,
      datumTimeSeconds: line.datumTimeSeconds,
      datumPinnedAt: line.datumPinnedAt,
    },
    after: {
      mdContent: line.after,
      indent: line.indent,
      datumTaskStatus: line.datumTaskStatus,
      datumTimeSeconds: line.datumTimeSeconds,
      datumPinnedAt: line.datumPinnedAt,
    },
  }))

/** Adapt tag rename rows to the shared multi-document review. */
export const TagRenameDiff = ({ proposal }: { proposal: Proposal }) => {
  const documents = useMemo<ProposedDocumentEdits[]>(
    () =>
      proposal.docs.map((doc) => ({
        title: doc.title,
        isTemplate: doc.isTemplate,
        changes: toChanges(doc),
      })),
    [proposal.docs]
  )

  return <DocumentEditsReview documents={documents} />
}
