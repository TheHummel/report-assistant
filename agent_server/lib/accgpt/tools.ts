/**
 * OpenAI-format tool definitions for ACCGPT agent
 * Tools for LaTeX document editing (get_context, propose_edits)
 */

import type {
  ACCGPTToolDefinition,
  AgentContext,
  ToolResult,
  ProjectFileContext,
} from './types';
import { LineEdit, validateLineEdits } from '../octra-agent/line-edits';
import { IntentResult } from '../octra-agent/intent-inference';

// ============================================================================
// Tool Definitions
// ============================================================================

export const GET_CONTEXT_TOOL: ACCGPTToolDefinition = {
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

export const PROPOSE_EDITS_TOOL: ACCGPTToolDefinition = {
  type: 'function',
  function: {
    name: 'propose_edits',
    description:
      'Propose JSON-structured line-based edits to LaTeX files. Each edit specifies a file path (optional, defaults to current file), line number, and operation (insert, delete, or replace). The user will review and accept/reject these edits.',
    parameters: {
      type: 'object',
      properties: {
        filePath: {
          type: 'string',
          description:
            'Optional: Path of the file to edit. If not provided, edits apply to the current file. Use paths from the project structure (e.g., "references.bib", "sections/introduction.tex").',
        },
        edits: {
          type: 'array',
          description: 'Array of edit operations to propose',
          items: {
            type: 'object',
            properties: {
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
export function getToolDefinitions(): ACCGPTToolDefinition[] {
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
  const requestedFilePath = args.filePath as string | undefined;
  const edits = args.edits as Array<{
    editType: 'insert' | 'delete' | 'replace';
    content?: string;
    position: { line: number };
    originalLineCount?: number;
    explanation?: string;
  }>;

  if (!Array.isArray(edits) || edits.length === 0) {
    return {
      tool_call_id: toolCallId,
      content: JSON.stringify({ error: 'No edits provided' }),
    };
  }

  // determine target file content for validation
  let targetFileContent: string;
  let targetFilePath: string;

  if (requestedFilePath) {
    const targetFile = agentContext.projectFiles?.find(
      (f) => f.path === requestedFilePath
    );

    if (!targetFile) {
      writeEvent('tool', {
        name: 'propose_edits',
        error: 'file_not_found',
        requestedPath: requestedFilePath,
      });
      return {
        tool_call_id: toolCallId,
        content: JSON.stringify({
          error: `Cannot edit file: ${requestedFilePath} not found in project`,
          availableFiles: agentContext.projectFiles?.map((f) => f.path) || [],
        }),
      };
    }

    targetFileContent = targetFile.content;
    targetFilePath = targetFile.path;
  } else {
    // default to current file
    targetFileContent = agentContext.fileContent;
    targetFilePath = agentContext.currentFilePath || 'current';
  }

  // validate edits against intent restrictions
  const validation = validateLineEdits(edits, intent, targetFileContent);

  // tag edits with file path and add to collection
  const editsWithFilePath = validation.acceptedEdits.map((edit) => ({
    ...edit,
    filePath: targetFilePath,
  }));

  collectedEdits.push(...editsWithFilePath);

  const totalEdits = validation.acceptedEdits.length;

  writeEvent('tool', {
    name: 'propose_edits',
    filePath: targetFilePath,
    count: totalEdits,
    violations: validation.violations,
  });

  if (totalEdits > 0) {
    // emit progress for each edit
    validation.acceptedEdits.forEach(() => {
      writeEvent('tool', {
        name: 'propose_edits',
        progress: 1,
      });
    });

    // emit full batch of edits with file path
    writeEvent('edits', editsWithFilePath);
  }

  const resultMessage = `Accepted ${validation.acceptedEdits.length} edit(s) for ${targetFilePath}.${
    validation.violations.length
      ? ` Blocked ${validation.violations.length} edit(s) due to intent restrictions.`
      : ''
  }`;

  return {
    tool_call_id: toolCallId,
    content: resultMessage,
  };
}
