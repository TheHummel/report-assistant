/**
 * Generic report initialization processor
 * Uses configuration from shared/report-init-config.ts
 *
 * All patterns, templates, and defaults are in the config.
 */

import type { LineEdit } from './line-edits';
import {
  INIT_TARGET_FILES,
  EDIT_PATTERNS,
  type ReportInitializationState,
} from '@shared/report-init-config';

/**
 * Find a block between start and end patterns
 * Returns { startLine, endLine, lineCount }
 */
function findBlock(
  lines: string[],
  startPattern: RegExp,
  endPattern: RegExp
): { startLine: number; endLine: number; lineCount: number } | null {
  const startLine = lines.findIndex((line) => startPattern.test(line));
  if (startLine === -1) return null;

  const endLine = lines.findIndex(
    (line, idx) => idx > startLine && endPattern.test(line)
  );
  if (endLine === -1) return null;

  return {
    startLine: startLine + 1, // convert to 1-indexed
    endLine: endLine + 1,
    lineCount: endLine - startLine + 1,
  };
}

/**
 * Generate deterministic line edits from report initialization state
 * Uses EDIT_PATTERNS from config to determine what to modify
 */
export function generateInitializationEdits(
  state: ReportInitializationState,
  fileContent: string,
  targetFilePath: string
): LineEdit[] {
  const edits: LineEdit[] = [];
  const lines = fileContent.split('\n');
  const { required_fields } = state;

  // Filter patterns for this specific file
  const relevantPatterns = EDIT_PATTERNS.filter(
    (pattern) => pattern.targetFile === targetFilePath
  );

  // Process all edit patterns from config
  for (const pattern of relevantPatterns) {
    // Check condition if specified
    if (pattern.condition && !pattern.condition(required_fields)) {
      continue;
    }

    if (pattern.type === 'single') {
      // Single-line replacement
      const lineNum =
        lines.findIndex((line) => pattern.startPattern.test(line)) + 1;
      if (lineNum > 0) {
        edits.push({
          editType: 'replace',
          position: { line: lineNum },
          content: pattern.buildContent(required_fields),
          originalLineCount: 1,
          filePath: targetFilePath,
        });
      }
    } else if (pattern.type === 'block' && pattern.endPattern) {
      // Block replacement
      const block = findBlock(lines, pattern.startPattern, pattern.endPattern);
      if (block) {
        edits.push({
          editType: 'replace',
          position: { line: block.startLine },
          content: pattern.buildContent(required_fields),
          originalLineCount: block.lineCount,
          filePath: targetFilePath,
        });
      }
    }
  }

  return edits;
}
