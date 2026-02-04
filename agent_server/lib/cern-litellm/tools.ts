/**
 * OpenAI-format tool definitions for CERN LiteLLM agent
 * Tools for LaTeX document editing (get_context, propose_edits)
 */

import type {
  CERNLiteLLMToolDefinition,
  AgentContext,
  ToolResult,
  ProjectFileContext,
} from './types';
import { LineEdit, validateLineEdits } from '../lars-agent/line-edits';
import { IntentResult } from '../lars-agent/intent-inference';

// ============================================================================
// Tool Definitions
// ============================================================================

export const GET_CONTEXT_TOOL: CERNLiteLLMToolDefinition = {
  type: 'function',
  function: {
    name: 'get_context',
    description:
      'Retrieve LaTeX file context with numbered lines. By default returns the current file. Use filePath parameter to retrieve content from other project files.',
    parameters: {
      type: 'object',
      properties: {
        filePath: {
          type: 'string',
          description:
            'Optional: Path of the file to retrieve. If not provided, returns the current file. Use paths from the project structure (e.g., "references.bib", "sections/introduction.tex").',
        },
        includeNumbered: {
          type: 'boolean',
          description:
            'Whether to include the full document with line numbers. Defaults to true.',
        },
        includeSelection: {
          type: 'boolean',
          description:
            "Whether to include the user's selected text (only applicable for current file). Defaults to true.",
        },
      },
      required: [],
    },
  },
};

export const PROPOSE_EDITS_TOOL: CERNLiteLLMToolDefinition = {
  type: 'function',
  function: {
    name: 'propose_edits',
    description:
      'Propose JSON-structured line-based edits to LaTeX files. Each edit can specify a file path (optional, defaults to current file), line number, and operation (insert, delete, or replace). The user will review and accept/reject these edits.',
    parameters: {
      type: 'object',
      properties: {
        edits: {
          type: 'array',
          description: 'Array of edit operations to propose',
          items: {
            type: 'object',
            properties: {
              filePath: {
                type: 'string',
                description:
                  'Optional: Path of the file to edit for this specific edit. Overrides the top-level filePath. Use paths from the project structure (e.g., "references.bib", "sections/introduction.tex").',
              },
              editType: {
                type: 'string',
                enum: ['insert', 'delete', 'replace'],
                description: 'The type of edit operation',
              },
              content: {
                type: 'string',
                description:
                  'The new content (required for insert/replace operations)',
              },
              position: {
                type: 'object',
                properties: {
                  line: {
                    type: 'integer',
                    minimum: 1,
                    description: 'Line number (1-indexed)',
                  },
                },
                required: ['line'],
              },
              originalLineCount: {
                type: 'integer',
                minimum: 0,
                description:
                  'How many lines to affect (for delete/replace). Defaults to 1.',
              },
              explanation: {
                type: 'string',
                description:
                  'Human-readable explanation of why this edit is being made',
              },
            },
            required: ['editType', 'position'],
          },
          minItems: 1,
        },
      },
      required: ['edits'],
    },
  },
};

/**
 * Get all available tools as an array
 */
export function getToolDefinitions(): CERNLiteLLMToolDefinition[] {
  return [GET_CONTEXT_TOOL, PROPOSE_EDITS_TOOL];
}

// ============================================================================
// Tool Execution
// ============================================================================

interface ToolExecutionContext {
  agentContext: AgentContext;
  intent: IntentResult;
  collectedEdits: LineEdit[];
  writeEvent: (event: string, data: unknown) => void;
}

/**
 * Execute a tool call and return the result
 */
export function executeToolCall(
  toolName: string,
  toolArgs: Record<string, unknown>,
  toolCallId: string,
  context: ToolExecutionContext
): ToolResult {
  switch (toolName) {
    case 'get_context':
      return executeGetContext(toolArgs, toolCallId, context);
    case 'propose_edits':
      return executeProposeEdits(toolArgs, toolCallId, context);
    default:
      return {
        tool_call_id: toolCallId,
        content: JSON.stringify({ error: `Unknown tool: ${toolName}` }),
      };
  }
}

/**
 * Execute get_context tool
 */
function executeGetContext(
  args: Record<string, unknown>,
  toolCallId: string,
  context: ToolExecutionContext
): ToolResult {
  const { agentContext, writeEvent } = context;
  const requestedFilePath = args.filePath as string | undefined;
  const includeNumbered = args.includeNumbered !== false;
  const includeSelection = args.includeSelection !== false;

  let targetFile: { path: string; content: string } | null = null;

  if (requestedFilePath) {
    // look for requested file in project files
    targetFile =
      agentContext.projectFiles?.find((f) => f.path === requestedFilePath) ||
      null;

    if (!targetFile) {
      writeEvent('tool', { name: 'get_context', error: 'file_not_found' });
      return {
        tool_call_id: toolCallId,
        content: JSON.stringify({
          error: `File not found: ${requestedFilePath}`,
          availableFiles: agentContext.projectFiles?.map((f) => f.path) || [],
        }),
      };
    }
  } else {
    // default to current file
    targetFile = {
      path: agentContext.currentFilePath || 'current',
      content: agentContext.fileContent,
    };
  }

  const payload: Record<string, unknown> = {
    filePath: targetFile.path,
    lineCount: targetFile.content.split('\n').length,
  };

  if (includeNumbered) {
    // number the lines of the target file
    const lines = targetFile.content.split('\n');
    payload.numberedContent = lines
      .map((line, index) => `${index + 1}: ${line}`)
      .join('\n');
  }

  // selection only applies to current file
  if (!requestedFilePath && includeSelection && agentContext.textFromEditor) {
    payload.selection = agentContext.textFromEditor;
  }

  if (!requestedFilePath && agentContext.selectionRange) {
    payload.selectionRange = agentContext.selectionRange;
  }

  if (agentContext.projectFiles?.length) {
    // Only include metadata to keep payload small
    payload.projectFiles = agentContext.projectFiles.map(
      (file: ProjectFileContext) => ({
        path: file.path,
        lineCount: file.content.split('\n').length,
        size: file.content.length,
        isCurrent: agentContext.currentFilePath
          ? agentContext.currentFilePath === file.path
          : false,
      })
    );
  }

  if (agentContext.currentFilePath) {
    payload.currentFilePath = agentContext.currentFilePath;
  }

  writeEvent('tool', { name: 'get_context', filePath: targetFile.path });

  return {
    tool_call_id: toolCallId,
    content: JSON.stringify(payload),
  };
}

/**
 * Execute propose_edits tool
 */
function executeProposeEdits(
  args: Record<string, unknown>,
  toolCallId: string,
  context: ToolExecutionContext
): ToolResult {
  const { agentContext, intent, collectedEdits, writeEvent } = context;
  
  // Handle double-nested edits: {"edits": {"edits": [...]}}
  let editsParam = args.edits;
  if (editsParam && typeof editsParam === 'object' && !Array.isArray(editsParam)) {
    const nestedEdits = (editsParam as Record<string, unknown>).edits;
    if (Array.isArray(nestedEdits)) {
      console.warn('[propose_edits] Detected double-nested edits, unwrapping...');
      editsParam = nestedEdits;
    }
  }
  
  const edits = editsParam as Array<{
    editType: 'insert' | 'delete' | 'replace';
    content?: string;
    position: { line: number };
    originalLineCount?: number;
    explanation?: string;
    filePath?: string; // target file path (defaults to current file if not specified)
  }>;

  if (!Array.isArray(edits) || edits.length === 0) {
    return {
      tool_call_id: toolCallId,
      content: JSON.stringify({ error: 'No edits provided' }),
    };
  }

  // group edits by target file
  const editsByFile = new Map<string, typeof edits>();

  for (const edit of edits) {
    // determine target file: per-edit filePath or current file
    const targetPath =
      edit.filePath || agentContext.currentFilePath || 'current';
    const existing = editsByFile.get(targetPath) || [];
    editsByFile.set(targetPath, [...existing, edit]);
  }

  let totalAccepted = 0;
  let totalViolations = 0;
  const fileResults: string[] = [];
  const allEditsWithFilePath: LineEdit[] = [];

  // process edits for each file
  for (const [targetFilePath, fileEdits] of editsByFile.entries()) {
    // get target file content for validation
    let targetFileContent: string;

    if (
      targetFilePath === 'current' ||
      targetFilePath === agentContext.currentFilePath
    ) {
      targetFileContent = agentContext.fileContent;
    } else {
      const targetFile = agentContext.projectFiles?.find(
        (f) => f.path === targetFilePath
      );

      if (!targetFile) {
        writeEvent('tool', {
          name: 'propose_edits',
          error: 'file_not_found',
          requestedPath: targetFilePath,
        });
        fileResults.push(`Cannot edit file: ${targetFilePath} not found`);
        continue;
      }

      targetFileContent = targetFile.content;
    }

    // validate edits for this file
    const validation = validateLineEdits(fileEdits, intent, targetFileContent);

    // tag edits with file path and add to collection
    const editsWithFilePath = validation.acceptedEdits.map((edit) => ({
      ...edit,
      filePath: targetFilePath,
    }));

    allEditsWithFilePath.push(...editsWithFilePath);
    collectedEdits.push(...editsWithFilePath);

    const acceptedCount = validation.acceptedEdits.length;
    const violationCount = validation.violations.length;

    totalAccepted += acceptedCount;
    totalViolations += violationCount;

    writeEvent('tool', {
      name: 'propose_edits',
      filePath: targetFilePath,
      count: acceptedCount,
      violations: validation.violations,
    });

    if (acceptedCount > 0) {
      fileResults.push(`${acceptedCount} edit(s) for ${targetFilePath}`);

      // emit progress for each edit
      validation.acceptedEdits.forEach(() => {
        writeEvent('tool', {
          name: 'propose_edits',
          progress: 1,
        });
      });
    }

    if (violationCount > 0) {
      fileResults.push(
        `Blocked ${violationCount} edit(s) in ${targetFilePath}`
      );
    }
  }

  // emit all edits at once
  if (allEditsWithFilePath.length > 0) {
    writeEvent('edits', allEditsWithFilePath);
  }

  const resultMessage =
    fileResults.length > 0
      ? `Accepted ${totalAccepted} total edit(s): ${fileResults.join('; ')}`
      : 'No edits accepted';

  return {
    tool_call_id: toolCallId,
    content: resultMessage,
  };
}
