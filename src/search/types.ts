// Search feature type definitions

import type { NoteDataStatus, NoteDataType } from '@/db/types'
// Result row types are not declared here — derive them from the router
// outputs (e.g. RouterOutputs['search']['searchLines']) so they can't drift.

// Operator types for the search query language
export type TagOperator = { type: 'tag'; value: string }
export type FromOperator = { type: 'from'; value: Date }
export type ToOperator = { type: 'to'; value: Date }
export type AgeOperator = { type: 'age'; value: number } // days
export type StatusOperator = { type: 'status'; value: NoteDataStatus }
export type HasOperator = { type: 'has'; value: Exclude<NoteDataType, 'tag'> }
export type DocOperator = { type: 'doc'; value: string } // glob pattern
export type TextOperator = {
  type: 'text'
  value: string
  wildcard: 'none' | 'prefix' | 'suffix' | 'exact'
}

export type SearchOperator =
  | TagOperator
  | FromOperator
  | ToOperator
  | AgeOperator
  | StatusOperator
  | HasOperator
  | DocOperator
  | TextOperator

export interface ParsedQuery {
  operators: SearchOperator[]
  errors: ParseError[]
}

export interface ParseError {
  position: number
  message: string
  token: string
}

// View mode for search results
export type SearchViewMode = 'text' | 'aggregate'
