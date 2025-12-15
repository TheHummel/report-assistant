import { useState, useEffect } from 'react';
import { EditSuggestion } from '@/types/edit';
import type * as Monaco from 'monaco-editor';
import { getStartLine, getOriginalLineCount, getSuggestedText } from './utils';

interface UseSuggestionDecorationsProps {
  editor: Monaco.editor.IStandaloneCodeEditor | null;
  monacoInstance: typeof Monaco | null;
  editSuggestions: EditSuggestion[];
  showInlinePreview?: boolean;
}

/**
 * Manages Monaco editor decorations for edit suggestions
 */
export function useSuggestionDecorations({
  editor,
  monacoInstance,
  editSuggestions,
  showInlinePreview = true,
}: UseSuggestionDecorationsProps) {
  const [decorationIds, setDecorationIds] = useState<string[]>([]);

  useEffect(() => {
    // Ensure editor and monaco are ready
    if (!editor || !monacoInstance) {
      return;
    }

    const model = editor.getModel();
    if (!model) {
      return;
    }

    const oldDecorationIds = decorationIds;
    const newDecorations: Monaco.editor.IModelDeltaDecoration[] = [];

    const pendingSuggestions = editSuggestions.filter(
      (s) => s.status === 'pending'
    );

    pendingSuggestions.forEach((suggestion) => {
      const startLineNumber = getStartLine(suggestion);
      const originalLineCount = getOriginalLineCount(suggestion);
      const suggestedText = getSuggestedText(suggestion);
      const modelLineCount = model.getLineCount();

      // clamp to valid decoration range
      const decorationStartLine = Math.min(startLineNumber, modelLineCount);
      const decorationEndLine = Math.min(
        originalLineCount > 0
          ? startLineNumber + originalLineCount - 1
          : startLineNumber,
        modelLineCount
      );

      const endColumn =
        originalLineCount > 0 ? model.getLineMaxColumn(decorationEndLine) : 1;

      const originalRange = new monacoInstance.Range(
        decorationStartLine,
        1,
        decorationEndLine,
        endColumn
      );

      // Mark original text with strikethrough (if any) + Glyph marker
      if (originalLineCount > 0) {
        newDecorations.push({
          range: originalRange,
          options: {
            className: 'octra-suggestion-deleted',
            glyphMarginClassName: 'octra-suggestion-glyph',
            glyphMarginHoverMessage: {
              value: `Suggestion: Replace Lines ${startLineNumber}-${decorationEndLine}`,
            },
            stickiness:
              monacoInstance.editor.TrackedRangeStickiness
                .NeverGrowsWhenTypingAtEdges,
          },
        });
      } else {
        // Pure insertion; just show glyph marker
        newDecorations.push({
          range: new monacoInstance.Range(
            decorationStartLine,
            1,
            decorationStartLine,
            1
          ),
          options: {
            glyphMarginClassName: 'octra-suggestion-glyph',
            glyphMarginHoverMessage: {
              value: `Suggestion: Insert at Line ${startLineNumber}`,
            },
            stickiness:
              monacoInstance.editor.TrackedRangeStickiness
                .NeverGrowsWhenTypingAtEdges,
          },
        });
      }

      // Show suggested text inline preview
      if (showInlinePreview && suggestedText?.trim()) {
        const inlineSuggestedContent = ` ${suggestedText.replace(/\n/g, ' ↵ ')}`;

        newDecorations.push({
          range: new monacoInstance.Range(
            decorationEndLine,
            endColumn,
            decorationEndLine,
            endColumn
          ),
          options: {
            after: {
              content: inlineSuggestedContent,
              inlineClassName: 'octra-suggestion-added',
            },
            stickiness:
              monacoInstance.editor.TrackedRangeStickiness
                .NeverGrowsWhenTypingAtEdges,
          },
        });
      }
    });

    // Apply decorations atomically
    const newDecorationIds = editor.deltaDecorations(
      oldDecorationIds,
      newDecorations
    );
    setDecorationIds(newDecorationIds);
  }, [editSuggestions, editor, monacoInstance, showInlinePreview]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (editor && decorationIds.length > 0) {
        editor.deltaDecorations(decorationIds, []);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return {
    decorationIds,
    setDecorationIds,
  };
}
