import { trpc } from '@/trpc/client'
import { toast } from 'sonner'
import { useNavigate } from '@tanstack/react-router'
import { docRoute } from '@/lib/utils'

export const useCreateDoc = (options?: {
  onSuccess?: (name: string) => void
  navigateOnSuccess?: boolean
}) => {
  const navigate = useNavigate()
  const utils = trpc.useUtils()

  return trpc.doc.createDoc.useMutation({
    onSuccess: (data) => {
      // Invalidate search query to show newly created doc
      utils.doc.searchDocs.invalidate()

      if (options?.onSuccess) {
        options.onSuccess(data.name)
      } else if (options?.navigateOnSuccess) {
        navigate({ to: docRoute(data.name), replace: true })
      }
    },
    onError: (error) => {
      toast.error(`Failed to create document: ${error.message}`)
    },
  })
}
