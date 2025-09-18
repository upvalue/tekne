import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/vendor/Dialog'
import { getDocTitle } from '@/lib/utils'
import { DocumentTextIcon } from '@heroicons/react/16/solid'
import { useState } from 'react'
import { trpc } from '@/trpc/client'
import { DialogDescription } from '@radix-ui/react-dialog'

const DocumentDetails = () => {
  const docTitle = getDocTitle()

  const { isLoading, data } = trpc.doc.loadDocDetails.useQuery({
    name: docTitle || '',
  })

  return (
    <div>
      {isLoading && <p>Loading...</p>}
      {!isLoading && (
        <div>
          <p>Created at: {data?.createdAt}</p>
          <p>Updated at: {data?.updatedAt}</p>
          <p>Revision: {data?.revision}</p>
        </div>
      )}
    </div>
  )
}

export const DocumentDetailsButton = () => {
  const [open, setOpen] = useState(false)

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger>
        <DocumentTextIcon className="w-4 h-4 cursor-pointer text-zinc-500" />
      </DialogTrigger>
      <DialogContent >
        <DialogHeader>
          <DialogTitle>Document Details</DialogTitle>
        </DialogHeader>
        <DialogDescription>Document details</DialogDescription>
        <DialogContent>{open && <DocumentDetails />}</DialogContent>
      </DialogContent>
    </Dialog>
  )
}
