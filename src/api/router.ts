import { docRouter } from './routers/doc'
import { analysisRouter } from './routers/analysis'
import { searchRouter } from './routers/search'
import { flagsRouter } from './routers/flags'
import { tagsRouter } from './routers/tags'
import { timersRouter } from './routers/timers'
import { tasksRouter } from './routers/tasks'

export const appRouter = {
  doc: docRouter,
  analysis: analysisRouter,
  search: searchRouter,
  flags: flagsRouter,
  tags: tagsRouter,
  tasks: tasksRouter,
  timers: timersRouter,
}

export type AppRouter = typeof appRouter
