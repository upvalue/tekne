// regex.ts - regex for syntax within lines

// (probably should eventually not use regex and parse everything properly)
// (but good enough for now)
export const InternalLinkRegex = new RegExp('[\$]?[a-zA-Z0-9 ]+\\]\\]')
// export const InternalLinkRegex = new RegExp('[$#][a-zA-Z0-9 /]+\\]\\]')

export const TAG_REGEX_STR = '^[a-zA-Z][a-zA-Z0-9-]*(?=\\s|$)'
export const FULL_TAG_REGEX_STR = `#${TAG_REGEX_STR}`
export const TAG_REGEX_MATCH_BEFORE_STR = `\\#[a-zA-Z][a-zA-Z0-9-]*`

export const TagRegex = new RegExp(TAG_REGEX_STR)
export const FullTagRegex = new RegExp(FULL_TAG_REGEX_STR)
export const TagRegexMatchBefore = new RegExp(TAG_REGEX_MATCH_BEFORE_STR)
