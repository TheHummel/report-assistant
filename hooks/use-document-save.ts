'use client';

import { useState } from 'react';
import { useDebouncedCallback } from 'use-debounce';
import { saveDocument } from '@/lib/requests/document';
import { useSelectedFile, useFileContent, FileActions } from '@/stores/file';
import { useProject } from '@/stores/project';
import { toast } from 'sonner';

export interface DocumentSaveState {
  isSaving: boolean;
  lastSaved: Date | null;
  handleSaveDocument: (contentToSave?: string) => Promise<boolean>;
  handleSaveAllModified: () => Promise<boolean>;
  debouncedSave: (content: string) => void;
  cancelPendingSave: () => void;
  setLastSaved: (date: Date | null) => void;
}

export function useDocumentSave(): DocumentSaveState {
  const project = useProject();
  const content = useFileContent();
  const selectedFile = useSelectedFile();

  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);

  const handleSaveDocument = async (
    contentToSave?: string
  ): Promise<boolean> => {
    try {
      if (!project?.id || !selectedFile) {
        return false;
      }

      const contentToUse =
        contentToSave !== undefined ? contentToSave : content;

      if (!contentToUse) {
        return false;
      }

      setIsSaving(true);

      const result = await saveDocument(
        project.id,
        selectedFile.id,
        contentToUse,
        selectedFile.name
      );

      if (!result.success) {
        return false;
      }

      // Mark file as saved (no longer modified)
      FileActions.markFileSaved(selectedFile.id);
      setLastSaved(new Date());
      return true;
    } catch (error) {
      console.error('Error saving document:', error);
      return false;
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveAllModified = async (): Promise<boolean> => {
    try {
      if (!project?.id) {
        return false;
      }

      const modifiedFiles = FileActions.getModifiedFilesData();
      
      if (modifiedFiles.length === 0) {
        toast.info('No unsaved changes');
        return true;
      }

      setIsSaving(true);
      const toastId = toast.loading(`Saving ${modifiedFiles.length} file(s)...`);

      let successCount = 0;
      let failCount = 0;

      for (const { fileId, fileName, content } of modifiedFiles) {
        try {
          const result = await saveDocument(
            project.id,
            fileId,
            content,
            fileName
          );

          if (result.success) {
            FileActions.markFileSaved(fileId);
            successCount++;
          } else {
            failCount++;
          }
        } catch (error) {
          console.error(`Error saving ${fileName}:`, error);
          failCount++;
        }
      }

      toast.dismiss(toastId);

      if (failCount === 0) {
        toast.success(`Saved ${successCount} file(s)`);
        setLastSaved(new Date());
        return true;
      } else if (successCount > 0) {
        toast.warning(`Saved ${successCount} file(s), ${failCount} failed`);
        return false;
      } else {
        toast.error('Failed to save files');
        return false;
      }
    } catch (error) {
      console.error('Error saving modified files:', error);
      toast.error('Failed to save files');
      return false;
    } finally {
      setIsSaving(false);
    }
  };

  const debouncedSave = useDebouncedCallback((content: string) => {
    handleSaveDocument(content);
  }, 1000);

  const cancelPendingSave = () => {
    debouncedSave.cancel();
  };

  return {
    isSaving,
    lastSaved,
    handleSaveDocument,
    handleSaveAllModified,
    debouncedSave,
    cancelPendingSave,
    setLastSaved,
  };
}
