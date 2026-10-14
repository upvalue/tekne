import { useQuery } from '@tanstack/react-query'
import { orpc } from '@/api/client'

/** Every document title, cached; callers filter locally. */
export const useDocumentTitles = () =>
  useQuery(
    orpc.doc.searchDocs.queryOptions({
      input: { query: '' },
      staleTime: 30_000,
    })
  )
