import { EditSuggestion } from '@/types/edit';
import type * as Monaco from 'monaco-editor';
import type { ProjectFile } from '@/hooks/use-file-editor';

/**
 * Internal types for edit suggestions management
 */

export interface EditSuggestionsState {
  editSuggestions: EditSuggestion[];
  totalPendingCount: number;
  decorationIds: string[];
  setDecorationIds: (ids: string[]) => void;
  handleEditSuggestion: (suggestion: EditSuggestion | EditSuggestion[]) => void;
  handleAcceptEdit: (suggestionId: string) => Promise<void>;
  handleAcceptAllEdits: () => Promise<void>;
  handleRejectEdit: (suggestionId: string) => void;
  handleNextSuggestion: () => void;
  finalizeEdits: () => void;
}

export interface UseEditSuggestionsProps {
  editor: Monaco.editor.IStandaloneCodeEditor | null;
  monacoInstance: typeof Monaco | null;
  showInlinePreview?: boolean; // controls inline 'after' preview decoration
  currentFilePath?: string | null;
  projectFiles?: ProjectFile[] | null;
  cancelPendingSave?: () => void; // cancel any pending debounced saves before file switch
}

export interface SuggestionQueueState {
  editSuggestions: EditSuggestion[];
  queuedSuggestions: EditSuggestion[];
  totalPendingCount: number;
  hasActiveBatch: boolean;
}
