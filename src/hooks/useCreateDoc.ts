import { apiErrorMessage } from '@/api/errors'
import { useQueryClient, useMutation } from '@tanstack/react-query'
import { orpc } from '@/api/client'
import { toast } from 'sonner'
import { useNavigate } from '@tanstack/react-router'
import { docRoute } from '@/lib/utils'

export const useCreateDoc = (options?: {
  onSuccess?: (name: string) => void
  navigateOnSuccess?: boolean
}) => {
  const navigate = useNavigate()
  const utils = useQueryClient()

  return useMutation(
    orpc.doc.createDoc.mutationOptions({
      onSuccess: (data) => {
        // Invalidate search query to show newly created doc
        utils.invalidateQueries({ queryKey: orpc.doc.searchDocs.key() })

        if (options?.onSuccess) {
          options.onSuccess(data.name)
        } else if (options?.navigateOnSuccess) {
          navigate({ to: docRoute(data.name), replace: true })
        }
      },
      onError: (error) => {
        toast.error(`Failed to create document: ${apiErrorMessage(error)}`)
      },
    })
  )
}
