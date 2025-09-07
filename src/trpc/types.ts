import type { inferRouterOutputs } from '@trpc/server'
import type { AppRouter } from '@/trpc/router'

export type RouterOutputs = inferRouterOutputs<AppRouter>

// Doc router types
export type ValidateAllDocsOutput = RouterOutputs['doc']['validateAllDocs']
export type MigrateAllDocsOutput = RouterOutputs['doc']['migrateAllDocs']
export type RecomputeAllDataOutput = RouterOutputs['doc']['recomputeAllData']

// Analysis router types
export type AggregateDataOutput = RouterOutputs['analysis']['aggregateData']