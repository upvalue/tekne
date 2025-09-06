import { IconBadge } from '@/components/IconBadge'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/vendor/Dialog'
import { formatDate, getDocTitle } from '@/lib/utils'
import { DocumentTextIcon } from '@heroicons/react/16/solid'
import { useEffect, useState } from 'react'
import { trpc } from '@/trpc/client'

const DocumentDetails = () => {
  const docTitle = getDocTitle()

  const { isLoading, data } = trpc.loadDocDetails.useQuery({
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
        <IconBadge icon={<DocumentTextIcon />} />
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Document Details</DialogTitle>
        </DialogHeader>
        <DialogContent>{open && <DocumentDetails />}</DialogContent>
      </DialogContent>
    </Dialog>
  )
}
