'use client'

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { FileText } from 'lucide-react'

export function ReferenceSheetModal() {
  const referenceSheetUrl = process.env.NEXT_PUBLIC_REFERENCE_SHEET_URL

  if (!referenceSheetUrl) {
    return null
  }

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" title="Reference Sheet">
          <FileText size={16} />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl h-[90vh] flex flex-col bg-white">
        <DialogHeader className="bg-white border-b border-gray-200 pb-4">
          <DialogTitle>Reference Sheet</DialogTitle>
        </DialogHeader>
        <div className="flex-1 overflow-auto bg-white p-4">
          <img
            src={referenceSheetUrl}
            alt="Reference Sheet"
            className="w-full h-auto"
          />
        </div>
      </DialogContent>
    </Dialog>
  )
}
