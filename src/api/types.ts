import type { InferRouterOutputs } from '@orpc/server'
import type { AppRouter } from '@/api/router'

export type RouterOutputs = InferRouterOutputs<AppRouter>

export type ValidateAllDocsOutput = RouterOutputs['doc']['validateAllDocs']
export type MigrateAllDocsOutput = RouterOutputs['doc']['migrateAllDocs']
export type RecomputeAllDataOutput = RouterOutputs['doc']['recomputeAllData']

export type AggregateDataOutput = RouterOutputs['analysis']['aggregateData']
