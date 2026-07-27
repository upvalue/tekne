// tag-rename.ts - pure logic for renaming/merging tags across documents.
//
// Tags exist only as inline `#tag` text inside line markdown, so a rename is
// a rewrite of `mdContent` guided by a real parse (never naive string
// replacement -- `#proj` is a prefix of `#project`, and edits shift offsets).
// Runs both server-side and in-browser (PGlite), so no server-only imports.
import MagicString from 'magic-string'
import { produce } from 'immer'
import type { SyntaxNode } from '@lezer/common'
import { TEKNE_MD_PARSER, visitMdTree } from '@/editor/parser'
import type { ZDoc } from '@/docs/schema'

/**
 * Computes the full set of tag renames for a request, expanding hierarchical
 * children (`proj` -> `proj/tekne`) when requested. All names are without
 * the leading '#'.
 */
export const computeRenamePairs = (
  oldName: string,
  newName: string,
  existingTags: string[],
  includeChildren: boolean
): Map<string, string> => {
  const pairs = new Map<string, string>([[oldName, newName]])
  if (includeChildren) {
    const prefix = oldName + '/'
    for (const tag of existingTags) {
      if (tag.startsWith(prefix)) {
        pairs.set(tag, newName + tag.slice(oldName.length))
      }
    }
  }
  return pairs
}

/** Child tags of `name` among `existingTags` (strict `name/` prefix). */
export const findChildTags = (
  name: string,
  existingTags: string[]
): string[] => {
  const prefix = name + '/'
  return existingTags.filter((t) => t.startsWith(prefix)).sort()
}

type TagNode = { from: number; to: number; name: string }

const collectTagNodes = (mdContent: string): TagNode[] => {
  const parsed = TEKNE_MD_PARSER.parse(mdContent)
  const nodes: TagNode[] = []
  visitMdTree(parsed.topNode, mdContent, 0, (node: SyntaxNode) => {
    if (node.type.name === 'Tag') {
      // Node text includes the leading '#'
      nodes.push({
        from: node.from,
        to: node.to,
        name: mdContent.slice(node.from + 1, node.to),
      })
    }
  })
  return nodes
}

/**
 * Rewrites the tags of a single line according to `pairs`.
 *
 * When a rename target already occurs on the line (a merge, e.g. `#a #b`
 * with a->b), the renamed occurrence is removed instead of duplicated,
 * along with one adjacent whitespace character.
 *
 * Returns the new content, or null if the line is unchanged.
 */
export const rewriteLineTags = (
  mdContent: string,
  pairs: Map<string, string>
): string | null => {
  const tagNodes = collectTagNodes(mdContent)
  if (!tagNodes.some((n) => pairs.has(n.name))) {
    return null
  }

  // Which original tag each final tag name comes from. A rename is dropped
  // (not duplicated) only when its target collides with a tag of a
  // *different* original name -- e.g. merging `#a` into an existing `#b`.
  // Duplicates the user already had (`#a ... #a`) are preserved as-is.
  const finalOrigin = new Map<string, string>()
  for (const n of tagNodes) {
    if (!pairs.has(n.name)) {
      finalOrigin.set(n.name, n.name)
    }
  }

  const ms = new MagicString(mdContent)
  for (const node of tagNodes) {
    const target = pairs.get(node.name)
    if (target === undefined) {
      continue
    }
    const origin = finalOrigin.get(target)
    if (origin !== undefined && origin !== node.name) {
      // Duplicate after rename: remove the tag and one adjacent space
      if (/\s/.test(mdContent[node.to] ?? '')) {
        ms.remove(node.from, node.to + 1)
      } else if (/\s/.test(mdContent[node.from - 1] ?? '')) {
        ms.remove(node.from - 1, node.to)
      } else {
        ms.remove(node.from, node.to)
      }
    } else {
      ms.update(node.from, node.to, '#' + target)
      finalOrigin.set(target, node.name)
    }
  }

  const result = ms.toString()
  return result === mdContent ? null : result
}

export type ChangedLine = {
  lineIdx: number
  before: string
  after: string
}

/**
 * Applies `pairs` to every line of a document. Only `mdContent` is touched;
 * line timestamps are deliberately left alone (matching document renames).
 */
export const rewriteDocTags = (
  doc: ZDoc,
  pairs: Map<string, string>
): { newDoc: ZDoc; changedLines: ChangedLine[] } => {
  const changedLines: ChangedLine[] = []
  const newDoc = produce(doc, (draft) => {
    draft.children.forEach((line, lineIdx) => {
      const rewritten = rewriteLineTags(line.mdContent, pairs)
      if (rewritten !== null) {
        changedLines.push({
          lineIdx,
          before: line.mdContent,
          after: rewritten,
        })
        draft.children[lineIdx].mdContent = rewritten
      }
    })
  })
  return { newDoc, changedLines }
}
