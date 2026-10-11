import { docRouter } from './routers/doc'
import { analysisRouter } from './routers/analysis'
import { searchRouter } from './routers/search'
import { flagsRouter } from './routers/flags'
import { tagsRouter } from './routers/tags'
import { tasksRouter } from './routers/tasks'

export const appRouter = {
  doc: docRouter,
  analysis: analysisRouter,
  search: searchRouter,
  flags: flagsRouter,
  tags: tagsRouter,
  tasks: tasksRouter,
}

export type AppRouter = typeof appRouter
