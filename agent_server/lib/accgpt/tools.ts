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
      'Retrieve the current LaTeX file context with numbered lines and optional user selection. Use this to understand the document structure before proposing edits.',
    parameters: {
      type: 'object',
      properties: {
        includeNumbered: {
          type: 'boolean',
          description:
            'Whether to include the full document with line numbers. Defaults to true.',
        },
        includeSelection: {
          type: 'boolean',
          description:
            "Whether to include the user's selected text. Defaults to true.",
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
      'Propose JSON-structured line-based edits to the LaTeX document. Each edit specifies a line number and the operation to perform (insert, delete, or replace). The user will review and accept/reject these edits.',
    parameters: {
      type: 'object',
      properties: {
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
  const includeNumbered = args.includeNumbered !== false;
  const includeSelection = args.includeSelection !== false;

  const payload: Record<string, unknown> = {
    lineCount: agentContext.fileContent.split('\n').length,
  };

  if (includeNumbered) {
    payload.numberedContent = agentContext.numberedContent;
  }

  if (includeSelection && agentContext.textFromEditor) {
    payload.selection = agentContext.textFromEditor;
  }

  if (agentContext.selectionRange) {
    payload.selectionRange = agentContext.selectionRange;
  }

  if (agentContext.projectFiles?.length) {
    payload.projectFiles = agentContext.projectFiles.map(
      (file: ProjectFileContext) => ({
        path: file.path,
        content: file.content,
        lineCount: file.content.split('\n').length,
        isCurrent: agentContext.currentFilePath
          ? agentContext.currentFilePath === file.path
          : false,
      })
    );
  }

  if (agentContext.currentFilePath) {
    payload.currentFilePath = agentContext.currentFilePath;
  }

  writeEvent('tool', { name: 'get_context' });

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

  // validate edits against intent restrictions
  const validation = validateLineEdits(edits, intent, agentContext.fileContent);

  // add accepted edits to collection
  collectedEdits.push(...validation.acceptedEdits);

  const totalEdits = validation.acceptedEdits.length;

  writeEvent('tool', {
    name: 'propose_edits',
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

    // emit full batch of edits
    writeEvent('edits', validation.acceptedEdits);
  }

  const resultMessage = `Accepted ${validation.acceptedEdits.length} edit(s).${
    validation.violations.length
      ? ` Blocked ${validation.violations.length} edit(s) due to intent restrictions.`
      : ''
  }`;

  return {
    tool_call_id: toolCallId,
    content: resultMessage,
  };
}
