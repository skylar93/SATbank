'use client'

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'

interface DeleteExamConfirmDialogProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: () => void
  examTitle: string
  isDeleting?: boolean
}

export function DeleteExamConfirmDialog({
  isOpen,
  onClose,
  onConfirm,
  examTitle,
  isDeleting = false,
}: DeleteExamConfirmDialogProps) {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="text-red-600">Delete Exam</DialogTitle>
          <DialogDescription className="text-gray-600">
            Are you sure you want to delete the exam{' '}
            <span className="font-semibold text-gray-800">"{examTitle}"</span>?
            <br />
            <br />
            <span className="text-red-600 font-medium">
              This action cannot be undone. All associated questions, student
              attempts, and results will be permanently deleted.
            </span>
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isDeleting}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={onConfirm}
            disabled={isDeleting}
            className="bg-red-600 hover:bg-red-700"
          >
            {isDeleting ? 'Deleting...' : 'Delete Exam'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
