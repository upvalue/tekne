// @vitest-environment node
import { afterAll, beforeAll, beforeEach, describe, expect, test } from 'vitest'
import type { Kysely } from 'kysely'
import type { Database } from '@/db/types'
import { makeTestDb } from '@/db/testing'
import { docMake, lineMake, type ZLine } from '@/docs/schema'
import { t } from '../init'
import { upsertNoteInTx } from './doc'
import { tasksRouter } from './tasks'

let db: Kysely<Database>
let caller: ReturnType<typeof createCaller>

const createCaller = t.createCallerFactory(tasksRouter)
const cutoff = '2025-02-01T00:00:00.000Z'

const task = (
  content: string,
  timeCreated: string,
  status: ZLine['datumTaskStatus'] = 'unset'
) =>
  lineMake(0, content, {
    timeCreated,
    timeUpdated: timeCreated,
    datumTaskStatus: status,
  })

const save = (title: string, lines: ZLine[]) =>
  upsertNoteInTx(db, title, docMake(lines))

beforeAll(async () => {
  ;({ db } = await makeTestDb())
  caller = createCaller({ db })
}, 60_000)

afterAll(async () => {
  await db.destroy()
})

beforeEach(async () => {
  await db.deleteFrom('notes').execute()
})

describe('stale task cancellation', () => {
  test('proposes every old unchecked task, including untagged tasks, and excludes templates', async () => {
    await save('Work', [
      task('untagged', '2025-01-01T00:00:00.000Z'),
      task('#todo tagged', '2025-01-02T00:00:00.000Z'),
      task('at cutoff', cutoff),
      task('done', '2025-01-03T00:00:00.000Z', 'complete'),
    ])
    await save('$Daily', [task('template', '2025-01-01T00:00:00.000Z')])

    const proposal = await caller.cancelStalePropose({ cutoff })

    expect(proposal.totalChanges).toBe(2)
    expect(proposal.documents).toHaveLength(1)
    expect(proposal.documents[0]).toMatchObject({
      title: 'Work',
      revision: 0,
      isTemplate: false,
    })
    expect(proposal.documents[0].changes).toHaveLength(2)
  })

  test('updates only selected documents and rebuilds derived task data', async () => {
    await save('A', [task('#todo first', '2025-01-01T00:00:00.000Z')])
    await save('B', [task('second', '2025-01-01T00:00:00.000Z')])
    const proposal = await caller.cancelStalePropose({ cutoff })
    const selected = proposal.documents.find(
      (document) => document.title === 'A'
    )!

    const result = await caller.cancelStaleExecute({
      cutoff,
      documents: [
        { title: selected.title, expectedRevision: selected.revision },
      ],
    })

    expect(result).toEqual({
      success: true,
      tasksUpdated: 1,
      documentsUpdated: 1,
    })
    const notes = await db
      .selectFrom('notes')
      .select(['title', 'body', 'revision'])
      .orderBy('title')
      .execute()
    expect(notes[0].body.children[0].datumTaskStatus).toBe('incomplete')
    expect(notes[0].revision).toBe(1)
    expect(notes[1].body.children[0].datumTaskStatus).toBe('unset')
    expect(notes[1].revision).toBe(0)

    const taskData = await db
      .selectFrom('note_data')
      .select(['note_title', 'datum_status'])
      .where('datum_type', '=', 'task')
      .executeTakeFirstOrThrow()
    expect(taskData).toEqual({ note_title: 'A', datum_status: 'incomplete' })
  })

  test('rejects an execution when a selected document changed after preview', async () => {
    await save('Work', [task('old task', '2025-01-01T00:00:00.000Z')])
    const proposal = await caller.cancelStalePropose({ cutoff })
    const selected = proposal.documents[0]
    await save('Work', [task('edited task', '2025-01-01T00:00:00.000Z')])

    await expect(
      caller.cancelStaleExecute({
        cutoff,
        documents: [
          { title: selected.title, expectedRevision: selected.revision },
        ],
      })
    ).rejects.toMatchObject({ code: 'CONFLICT' })

    const note = await db
      .selectFrom('notes')
      .select(['body', 'revision'])
      .where('title', '=', 'Work')
      .executeTakeFirstOrThrow()
    expect(note.body.children[0].datumTaskStatus).toBe('unset')
    expect(note.revision).toBe(1)
  })
})
