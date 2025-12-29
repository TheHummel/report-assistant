'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useProjectFilesRevalidation } from '@/hooks/use-file-editor';
import { deleteFolder } from '@/lib/requests/project';
import { AlertTriangle } from 'lucide-react';

interface DeleteFolderDialogProps {
  projectId: string;
  folderPath: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDeleted?: () => void;
}

export function DeleteFolderDialog({
  projectId,
  folderPath,
  open,
  onOpenChange,
  onDeleted,
}: DeleteFolderDialogProps) {
  const [isLoading, setIsLoading] = useState(false);
  const { revalidate } = useProjectFilesRevalidation(projectId);

  const folderName = folderPath.includes('/')
    ? folderPath.substring(folderPath.lastIndexOf('/') + 1)
    : folderPath;

  const handleDelete = async () => {
    setIsLoading(true);

    try {
      await deleteFolder(projectId, folderPath);
      onDeleted?.();
      onOpenChange(false);

      revalidate().then(() => {
        toast.success('Folder deleted successfully');
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Failed to delete folder';
      toast.error(message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="size-5 text-destructive" />
            Delete Folder
          </DialogTitle>
          <DialogDescription>
            Are you sure you want to delete &quot;{folderName}&quot;? This will
            permanently delete the folder and all its contents. This action
            cannot be undone.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isLoading}
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="destructive"
            onClick={handleDelete}
            disabled={isLoading}
          >
            {isLoading ? 'Deleting...' : 'Delete Folder'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
