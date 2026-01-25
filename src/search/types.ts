// Search feature type definitions

import type { NoteDataStatus, NoteDataType } from '@/db/types'

// Operator types for the search query language
export type TagOperator = { type: 'tag'; value: string }
export type FromOperator = { type: 'from'; value: Date }
export type ToOperator = { type: 'to'; value: Date }
export type AgeOperator = { type: 'age'; value: number } // days
export type StatusOperator = { type: 'status'; value: NoteDataStatus }
export type HasOperator = { type: 'has'; value: Exclude<NoteDataType, 'tag'> }
export type DocOperator = { type: 'doc'; value: string } // glob pattern
export type TextWildcard = 'none' | 'prefix' | 'suffix' | 'exact'
export type TextOperator = { type: 'text'; value: string; wildcard: TextWildcard }

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

// Result types for search queries
export interface SearchLineResult {
  note_title: string
  line_idx: number
  content: string
  time_created: Date
  tags: string[]
  has_timer: boolean
  has_task: boolean
  task_status: NoteDataStatus | null
}

export interface SearchAggregateResult {
  tag: string
  complete_tasks: number
  incomplete_tasks: number
  unset_tasks: number
  total_time_seconds: number
  pinned_at: Date | null
  pinned_desc: string | null
}

// Saved search types
export interface SavedSearch {
  id: number
  name: string
  query: string
  created_at: Date
  updated_at: Date
}

// View mode for search results
export type SearchViewMode = 'text' | 'aggregate'
