// regex.ts - regex for syntax within lines

// (probably should eventually not use regex and parse everything properly)
// (but good enough for now)
export const DOCUMENT_NAME_BODY = String.raw`[a-zA-Z0-9\s\-_.,:;()[\]{}'"/\\&*+~\x60|]`

export const DocumentNameRegex = new RegExp(`^\\$?${DOCUMENT_NAME_BODY}+$`)

// Inline links end at the first closing delimiter and cannot span lines.
export const InternalLinkRegex = new RegExp(
  `^\\$?(?:(?![\\r\\n])${DOCUMENT_NAME_BODY})+?\\]\\]`
)

const TAG_BODY_STR = '[a-zA-Z][a-zA-Z0-9-/]*'

export const TAG_REGEX_STR = `^${TAG_BODY_STR}(?=\\s|$)`
export const TAG_REGEX_MATCH_BEFORE_STR = `\\#${TAG_BODY_STR}`

export const TagRegex = new RegExp(TAG_REGEX_STR)
export const TagRegexMatchBefore = new RegExp(TAG_REGEX_MATCH_BEFORE_STR)

/** Matches a standalone tag name (no leading '#', whole string). */
export const TagNameExactRegex = new RegExp(`^${TAG_BODY_STR}$`)
