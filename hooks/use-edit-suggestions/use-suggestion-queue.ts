import { useState, useRef, useCallback, useEffect } from 'react';
import { EditSuggestion } from '@/types/edit';
import { toast } from 'sonner';
import {
  normalizeSuggestions,
  getOriginalTextFromModel,
  getStartLine,
  getOriginalLineCount,
} from './utils';
import type * as Monaco from 'monaco-editor';
import { FileActions } from '@/stores/file';
import type { ProjectFile } from '@/hooks/use-file-editor';

interface UseSuggestionQueueProps {
  editor: Monaco.editor.IStandaloneCodeEditor | null;
  currentFilePath?: string | null;
  projectFiles?: ProjectFile[] | null;
  cancelPendingSave?: () => void;
}

interface FileGroup {
  filePath: string;
  suggestions: EditSuggestion[];
}

/**
 * Manages the queue of edit suggestions with batching logic and multi-file support
 */
export function useSuggestionQueue({
  editor,
  currentFilePath,
  projectFiles,
  cancelPendingSave,
}: UseSuggestionQueueProps) {
  const [editSuggestions, setEditSuggestions] = useState<EditSuggestion[]>([]);
  const suggestionQueueRef = useRef<EditSuggestion[]>([]);
  const fileQueueRef = useRef<FileGroup[]>([]);
  const currentFileGroupRef = useRef<string | null>(null);
  const continueToastIdRef = useRef<string | number | null>(null);
  const promptDisplayedRef = useRef(false);
  const hasActiveBatchRef = useRef(false);
  const accumulatedEditsRef = useRef<EditSuggestion[]>([]);
  const isAccumulatingRef = useRef(false);
  const isSwitchingFileRef = useRef(false); // prevent duplicate auto-switches
  const justLoadedSuggestionsRef = useRef(false); // Track if we just loaded suggestions this render

  const clearContinueToast = useCallback(() => {
    if (continueToastIdRef.current !== null) {
      toast.dismiss(continueToastIdRef.current);
      continueToastIdRef.current = null;
    }
  }, []);

  /**
   * Switch to a specific file if it exists in project
   */
  const switchToFile = useCallback(
    (filePath: string) => {
      if (!projectFiles) {
        return false;
      }

      const targetFile = projectFiles.find((f) => f.file.name === filePath);
      if (targetFile) {
        if (cancelPendingSave) {
          cancelPendingSave();
        }

        FileActions.setSelectedFile(targetFile.file);
        return true;
      }

      return false;
    },
    [projectFiles, cancelPendingSave]
  );

  /**
   * Group suggestions by file path
   */
  const groupSuggestionsByFile = useCallback(
    (suggestions: EditSuggestion[]): FileGroup[] => {
      const groups = new Map<string, EditSuggestion[]>();

      suggestions.forEach((suggestion) => {
        const filePath = suggestion.filePath || currentFilePath || 'current';
        const existing = groups.get(filePath) || [];
        groups.set(filePath, [...existing, suggestion]);
      });

      return Array.from(groups.entries()).map(([filePath, suggestions]) => ({
        filePath,
        suggestions,
      }));
    },
    [currentFilePath]
  );

  const applyIncomingSuggestions = useCallback(
    (
      incoming: EditSuggestion[],
      options: { suppressLimitNotice?: boolean } = {}
    ) => {
      // Enrich suggestions with original text from the current model when missing
      // Only enrich for suggestions targeting the current file
      const model: Monaco.editor.ITextModel | null = editor
        ? editor.getModel()
        : null;

      const withOriginals = incoming.map((s) => {
        // Skip enrichment if no model, already has original, or targets a different file
        const isCurrentFile =
          !s.filePath ||
          s.filePath === currentFilePath ||
          s.filePath === 'current';
        if (s.original !== undefined || !model || !isCurrentFile) return s;

        return {
          ...s,
          original: getOriginalTextFromModel(
            model,
            getStartLine(s),
            getOriginalLineCount(s)
          ),
        };
      });

      const normalized = normalizeSuggestions(withOriginals);
      const fileGroups = groupSuggestionsByFile(normalized);

      if (fileGroups.length === 0) {
        setEditSuggestions([]);
        fileQueueRef.current = [];
        currentFileGroupRef.current = null;
        return;
      }

      // Get first file group
      const firstGroup = fileGroups[0];
      const remainingGroups = fileGroups.slice(1);

      // Store remaining file groups
      fileQueueRef.current = remainingGroups;
      currentFileGroupRef.current = firstGroup.filePath;

      // Switch to first file if needed
      if (
        firstGroup.filePath !== currentFilePath &&
        firstGroup.filePath !== 'current'
      ) {
        const switched = switchToFile(firstGroup.filePath);
        if (switched) {
          toast.info(`Switched to "${firstGroup.filePath}" for review`, {
            duration: 2000,
          });

          // Store the suggestions to be shown after file loads
          fileQueueRef.current = [firstGroup, ...remainingGroups];
          currentFileGroupRef.current = firstGroup.filePath;
          return;
        }
      }

      // If no switch needed, show suggestions immediately
      // Show first batch of suggestions from first file
      const firstBatch = firstGroup.suggestions.slice(0, 5);
      const remaining = firstGroup.suggestions.slice(5);

      setEditSuggestions(firstBatch);
      suggestionQueueRef.current = remaining;
      hasActiveBatchRef.current = firstBatch.length > 0;
      promptDisplayedRef.current = false;
      clearContinueToast();

      // Show info about multi-file edits
      const totalFiles = 1 + remainingGroups.length;
      const totalEdits = normalized.length;

      if (totalFiles > 1) {
        toast.info(
          `Reviewing ${firstGroup.suggestions.length} edit(s) in "${firstGroup.filePath}". ${remainingGroups.length} more file(s) pending.`,
          { duration: 3000 }
        );
      } else if (remaining.length > 0) {
        toast.info(
          'Showing the first 5 AI suggestions. Continue when you are ready to review more.'
        );
      }
    },
    [
      editor,
      clearContinueToast,
      groupSuggestionsByFile,
      currentFilePath,
      switchToFile,
    ]
  );

  const handleEditSuggestion = useCallback(
    (suggestionInput: EditSuggestion | EditSuggestion[]) => {
      const incomingArray = Array.isArray(suggestionInput)
        ? suggestionInput
        : [suggestionInput];

      if (incomingArray.length === 0) {
        // Finalize accumulated edits if any
        if (accumulatedEditsRef.current.length > 0) {
          applyIncomingSuggestions(accumulatedEditsRef.current);
          accumulatedEditsRef.current = [];
          isAccumulatingRef.current = false;
        } else {
          setEditSuggestions([]);
          suggestionQueueRef.current = [];
          hasActiveBatchRef.current = false;
          promptDisplayedRef.current = false;
          clearContinueToast();
        }
        return;
      }

      // Check if this is a new agent session
      if (
        !isAccumulatingRef.current &&
        accumulatedEditsRef.current.length === 0
      ) {
        isAccumulatingRef.current = true;
      }

      // Accumulate edits
      accumulatedEditsRef.current = [
        ...accumulatedEditsRef.current,
        ...incomingArray,
      ];
    },
    [applyIncomingSuggestions, clearContinueToast]
  );

  /**
   * Finalize accumulated edits - call this when agent stream completes
   */
  const finalizeEdits = useCallback(() => {
    if (accumulatedEditsRef.current.length > 0) {
      applyIncomingSuggestions(accumulatedEditsRef.current);
      accumulatedEditsRef.current = [];
    }
    isAccumulatingRef.current = false;
  }, [applyIncomingSuggestions]);

  const handleNextSuggestion = useCallback(() => {
    // Check if there are more suggestions in current file
    if (suggestionQueueRef.current.length > 0) {
      const nextBatch = suggestionQueueRef.current
        .slice(0, 5)
        .map((suggestion) => ({
          ...suggestion,
          status: 'pending' as const,
        }));

      suggestionQueueRef.current = suggestionQueueRef.current
        .slice(5)
        .map((suggestion) => ({
          ...suggestion,
          status: 'pending' as const,
        }));

      setEditSuggestions(nextBatch);
      hasActiveBatchRef.current = nextBatch.length > 0;
      promptDisplayedRef.current = false;
      clearContinueToast();
      return;
    }

    // No more suggestions in current file, check if there are more files
    if (fileQueueRef.current.length > 0) {
      const nextFileGroup = fileQueueRef.current[0];
      const remainingGroups = fileQueueRef.current.slice(1);
      currentFileGroupRef.current = nextFileGroup.filePath;

      // Switch to next file
      if (
        nextFileGroup.filePath !== currentFilePath &&
        nextFileGroup.filePath !== 'current'
      ) {
        const switched = switchToFile(nextFileGroup.filePath);
        if (switched) {
          toast.info(`Switched to "${nextFileGroup.filePath}" for review`, {
            duration: 2000,
          });

          return;
        }
      }

      // If no switch needed, show suggestions immediately
      fileQueueRef.current = remainingGroups;
      const firstBatch = nextFileGroup.suggestions.slice(0, 5);
      const remaining = nextFileGroup.suggestions.slice(5);

      setEditSuggestions(firstBatch);
      suggestionQueueRef.current = remaining;
      hasActiveBatchRef.current = firstBatch.length > 0;
      promptDisplayedRef.current = false;
      clearContinueToast();

      if (remainingGroups.length > 0) {
        toast.info(
          `Reviewing ${nextFileGroup.suggestions.length} edit(s) in \"${nextFileGroup.filePath}\". ${remainingGroups.length} more file(s) pending.`,
          { duration: 3000 }
        );
      }
      return;
    }

    // no remaining suggestions
    clearContinueToast();
    hasActiveBatchRef.current = false;
    promptDisplayedRef.current = false;
  }, [clearContinueToast, currentFilePath, switchToFile]);

  // Show queued suggestions when currentFilePath matches the queued file
  useEffect(() => {
    if (!currentFileGroupRef.current || fileQueueRef.current.length === 0) {
      return;
    }

    const firstGroup = fileQueueRef.current[0];

    // Check if current file matches the first queued group
    if (firstGroup.filePath === currentFilePath) {
      const remainingGroups = fileQueueRef.current.slice(1);
      fileQueueRef.current = remainingGroups;

      const firstBatch = firstGroup.suggestions.slice(0, 5);
      const remaining = firstGroup.suggestions.slice(5);

      setEditSuggestions(firstBatch);
      suggestionQueueRef.current = remaining;
      hasActiveBatchRef.current = firstBatch.length > 0;
      promptDisplayedRef.current = false;
      isSwitchingFileRef.current = false; // Reset switch flag when showing suggestions
      justLoadedSuggestionsRef.current = true; // Mark that just loaded suggestions
      clearContinueToast();

      // Show info about multi-file edits
      const totalFiles = 1 + remainingGroups.length;
      if (totalFiles > 1) {
        toast.info(
          `Reviewing ${firstGroup.suggestions.length} edit(s) in \"${firstGroup.filePath}\". ${remainingGroups.length} more file(s) pending.`,
          { duration: 3000 }
        );
      }
    }
  }, [currentFilePath, clearContinueToast]);

  // Show continue prompt when current batch is complete
  useEffect(() => {
    // Skip auto-switch logic if just loaded suggestions this render
    if (justLoadedSuggestionsRef.current) {
      justLoadedSuggestionsRef.current = false;
      return;
    }

    const pendingCount = editSuggestions.filter(
      (suggestion) => suggestion.status === 'pending'
    ).length;

    if (pendingCount > 0) {
      hasActiveBatchRef.current = true;
      return;
    }

    if (!hasActiveBatchRef.current) {
      clearContinueToast();
      promptDisplayedRef.current = false;
      return;
    }

    // Check if there are more suggestions in current file
    if (suggestionQueueRef.current.length > 0) {
      if (!promptDisplayedRef.current) {
        const toastId = toast.info(
          'More AI suggestions are ready. Continue when you want to review the next batch.',
          {
            action: {
              label: 'Continue',
              onClick: () => {
                clearContinueToast();
                promptDisplayedRef.current = false;
                handleNextSuggestion();
              },
            },
          }
        );
        continueToastIdRef.current = toastId as string | number;
        promptDisplayedRef.current = true;
      }
      return;
    }

    // Check if there are more files to review
    if (fileQueueRef.current.length > 0) {
      // Prevent duplicate auto-switches
      if (isSwitchingFileRef.current) {
        return;
      }

      isSwitchingFileRef.current = true;
      // Automatically move to next file
      handleNextSuggestion();
      return;
    }

    // No more suggestions at all
    hasActiveBatchRef.current = false;
    promptDisplayedRef.current = false;
    clearContinueToast();
  }, [editSuggestions, clearContinueToast, handleNextSuggestion]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      clearContinueToast();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const totalPendingCount =
    editSuggestions.filter((s) => s.status === 'pending').length +
    suggestionQueueRef.current.length;

  return {
    editSuggestions,
    setEditSuggestions,
    queuedSuggestions: suggestionQueueRef.current,
    totalPendingCount,
    handleEditSuggestion,
    handleNextSuggestion,
    clearContinueToast,
    finalizeEdits,
  };
}
