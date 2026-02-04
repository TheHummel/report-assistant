/**
 * CERN Agent Service for Octree LaTeX Editor
 *
 * Uses CERN LiteLLM API
 *
 * Features:
 * - Agentic loop with tool calls
 * - SSE streaming (compatible with existing frontend)
 * - Same tool interface (get_context, propose_edits)
 */

// Load environment variables from .env.local
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import express from 'express';
import cors from 'cors';
import {
  buildNumberedContent,
  buildSystemPrompt,
  inferIntent,
} from './lib/octra-agent';
import { loadInitState } from './lib/init-state-store';
import { createImageToLatexRouter } from './routes/image-to-latex';
import { createAgentInitRouter } from './routes/agent-init';
import {
  getToolDefinitions,
  executeToolCall,
  CERNLiteLLMRequest,
  CERNLiteLLMResponse,
  CERNLiteLLMMessage,
  CERNLiteLLMToolCall,
  AgentContext,
  ProjectFileContext,
} from './lib/cern-litellm';
import type { LineEdit } from './lib/octra-agent/line-edits';
import type { IntentResult } from './lib/octra-agent/intent-inference';

const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' }));

// ============================================================================
// Configuration
// ============================================================================

const CERN_LITELLM_URL = process.env.CERN_LITELLM_URL!;
const CERN_LITELLM_API_KEY = process.env.CERN_LITELLM_API_KEY!;
const CERN_LITELLM_MODEL = process.env.CERN_LITELLM_MODEL!;
const CERN_LITELLM_VISION_MODEL = process.env.CERN_LITELLM_VISION_MODEL!;
const MAX_AGENT_ITERATIONS = 10; // Safety limit for agentic loop
const TOOL_CALL_DELAY_MS = parseInt(process.env.TOOL_CALL_DELAY_MS || '0', 10);

// ============================================================================
// Mount Route Modules
// ============================================================================

// Image-to-LaTeX route
app.use(
  '/agent',
  createImageToLatexRouter({
    cernLiteLLMUrl: CERN_LITELLM_URL,
    cernLiteLLMApiKey: CERN_LITELLM_API_KEY,
    cernLiteLLMVisionModel: CERN_LITELLM_VISION_MODEL,
  })
);

// Report initialization routes
app.use('/agent', createAgentInitRouter());

// ============================================================================
// Helper Functions
// ============================================================================

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function validateApiConfig(): { isValid: boolean; error?: string } {
  if (!CERN_LITELLM_URL) {
    return { isValid: false, error: 'CERN_LITELLM_URL is not configured' };
  }
  if (!CERN_LITELLM_API_KEY) {
    return { isValid: false, error: 'CERN_LITELLM_API_KEY is not configured' };
  }
  return { isValid: true };
}

/**
 * Call CERN LiteLLM API with streaming support and emit chunks to client
 */
async function callCERNLiteLLMStreaming(
  request: CERNLiteLLMRequest,
  onChunk?: (content: string) => void
): Promise<CERNLiteLLMResponse> {
  const response = await fetch(CERN_LITELLM_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-API-Key': CERN_LITELLM_API_KEY,
    },
    body: JSON.stringify({
      ...request,
      stream: true,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `CERN LiteLLM API error (${response.status}): ${errorText}`
    );
  }

  if (!response.body) {
    throw new Error('No response body from CERN LiteLLM');
  }

  // Parse streaming response
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let finalResponse: CERNLiteLLMResponse | null = null;
  let accumulatedContent = '';
  let accumulatedToolCalls: CERNLiteLLMToolCall[] = [];

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';

    for (const line of lines) {
      if (!line.trim() || line.startsWith(':')) continue;
      if (!line.startsWith('data: ')) continue;

      const data = line.slice(6);
      if (data === '[DONE]') continue;

      try {
        const chunk = JSON.parse(data) as any;

        // Handle direct OpenAI format
        if (chunk.choices?.[0]?.delta) {
          const delta = chunk.choices[0].delta;

          if (delta.content) {
            accumulatedContent += delta.content;
            // Emit chunk to client immediately
            if (onChunk) {
              onChunk(delta.content);
            }
          }

          if (delta.tool_calls) {
            for (const toolCallDelta of delta.tool_calls) {
              const index = toolCallDelta.index;
              if (!accumulatedToolCalls[index]) {
                accumulatedToolCalls[index] = {
                  id: toolCallDelta.id || '',
                  type: 'function',
                  function: {
                    name: toolCallDelta.function?.name || '',
                    arguments: toolCallDelta.function?.arguments || '',
                  },
                };
              } else {
                if (toolCallDelta.function?.name) {
                  accumulatedToolCalls[index].function.name +=
                    toolCallDelta.function.name;
                }
                if (toolCallDelta.function?.arguments) {
                  accumulatedToolCalls[index].function.arguments +=
                    toolCallDelta.function.arguments;
                }
              }
            }
          }

          // Build final response structure
          finalResponse = {
            choices: [
              {
                message: {
                  role: 'assistant',
                  content: accumulatedContent,
                  tool_calls:
                    accumulatedToolCalls.length > 0
                      ? accumulatedToolCalls
                      : undefined,
                },
                finish_reason: chunk.choices[0].finish_reason || null,
              },
            ],
          } as any;
        }
        // Handle wrapped format (steps)
        else if (chunk.steps) {
          finalResponse = chunk as CERNLiteLLMResponse;
        }
      } catch (e) {
        console.warn('[CERN LiteLLM] Failed to parse streaming chunk:', e);
      }
    }
  }

  if (!finalResponse) {
    throw new Error('No valid response received from CERN LiteLLM stream');
  }

  return finalResponse;
}

/**
 * Extract text content from CERN LiteLLM response
 * Handles both wrapped (steps) and unwrapped (direct OpenAI) formats
 */
function extractTextContent(response: CERNLiteLLMResponse): string {
  // Check for direct OpenAI format first (choices at root level)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const anyResponse = response as any;
  if (anyResponse.choices?.[0]?.message?.content) {
    return anyResponse.choices[0].message.content;
  }

  // Wrapped format (steps array)
  const step = response.steps?.[0];
  if (!step) return '';

  // Try to get content from the content array first
  if (step.content?.length) {
    return step.content
      .filter((c) => c.type === 'text')
      .map((c) => c.text)
      .join('');
  }

  // Fallback to response.body.choices
  const choice = step.response?.body?.choices?.[0];
  return choice?.message?.content || '';
}

/**
 * Extract tool calls from LiteLLM response
 * Handles both wrapped (steps) and unwrapped (direct OpenAI) formats
 */
function extractToolCalls(
  response: CERNLiteLLMResponse
): CERNLiteLLMToolCall[] {
  // Check for direct OpenAI format first (choices at root level)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const anyResponse = response as any;
  if (anyResponse.choices?.[0]?.message?.tool_calls) {
    return anyResponse.choices[0].message.tool_calls;
  }

  // Wrapped format (steps array)
  const step = response.steps?.[0];
  if (!step) return [];

  const choice = step.response?.body?.choices?.[0];
  return choice?.message?.tool_calls || [];
}

/**
 * Check if the response indicates completion (no more tool calls needed)
 * Handles both wrapped (steps) and unwrapped (direct OpenAI) formats
 */
function isComplete(response: CERNLiteLLMResponse): boolean {
  // Check for direct OpenAI format first
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const anyResponse = response as any;
  if (anyResponse.choices?.[0]?.finish_reason) {
    const finishReason = anyResponse.choices[0].finish_reason;
    return finishReason === 'stop' || finishReason === 'length';
  }

  // Wrapped format (steps array)
  const step = response.steps?.[0];
  if (!step) return true;

  const finishReason =
    step.finishReason || step.response?.body?.choices?.[0]?.finish_reason;
  return finishReason === 'stop' || finishReason === 'length';
}

// ============================================================================
// Main Agent Endpoint
// ============================================================================

app.post('/agent', async (req: express.Request, res: express.Response) => {
  try {
    // Validate API configuration
    const configValidation = validateApiConfig();
    if (!configValidation.isValid) {
      return res.status(503).json({ error: configValidation.error });
    }

    // Parse request body
    const {
      messages,
      fileContent,
      textFromEditor,
      selectionRange,
      projectFiles: projectFilesPayload,
      currentFilePath,
      projectId,
      userId,
    } = req.body || {};

    console.log('[DEBUG] Full request body keys:', Object.keys(req.body || {}));
    console.log('[DEBUG] projectId:', projectId);
    console.log('[DEBUG] userId:', userId);

    // Load initialization state if projectId or userId provided
    const stateKey = projectId || userId;
    let reportInitState = null;
    if (stateKey) {
      reportInitState = await loadInitState(stateKey);
      if (reportInitState) {
        console.log('[Agent] Loaded initialization state for:', stateKey);
      }
    }

    // filter out file with .cls
    const filteredProjectFilesPayload = Array.isArray(projectFilesPayload)
      ? projectFilesPayload.filter(
          (file: { path?: unknown }) =>
            typeof file.path === 'string' && !file.path.endsWith('cls')
        )
      : [];

    if (!messages?.length || typeof fileContent !== 'string') {
      return res
        .status(400)
        .json({ error: 'Invalid request: messages and fileContent required' });
    }

    // Set up SSE response first
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');

    const writeEvent = (event: string, data: unknown) => {
      res.write(`event: ${event}\n`);
      res.write(`data: ${JSON.stringify(data)}\n\n`);
    };

    // Build context (non-blocking)
    const numberedContent = await buildNumberedContent(
      fileContent,
      textFromEditor
    );

    // Regular chat flow - build user message
    const userText =
      typeof messages[messages.length - 1]?.content === 'string'
        ? messages[messages.length - 1].content
        : '';

    const intent: IntentResult = await inferIntent(userText);
    const collectedEdits: LineEdit[] = [];

    // Prepare previous messages (excluding system messages)
    const previousMessages = messages
      .slice(0, -1)
      .filter((msg: { role: string }) => msg.role !== 'system')
      // .slice(-10) // keep last 10 messages for context without bloating
      .map((msg: { role: string; content: string }) => ({
        role: msg.role,
        content: msg.content,
      }));

    // Process project files
    const projectFiles: ProjectFileContext[] = Array.isArray(
      filteredProjectFilesPayload
    )
      ? filteredProjectFilesPayload
          .filter(
            (file: unknown): file is { path: string; content: string } =>
              !!file &&
              typeof (file as { path?: unknown }).path === 'string' &&
              typeof (file as { content?: unknown }).content === 'string'
          )
          .map((file) => ({ path: file.path, content: file.content }))
      : [];

    const normalizedCurrentFilePath =
      typeof currentFilePath === 'string' ? currentFilePath : null;

    // Build agent context
    const agentContext: AgentContext = {
      fileContent,
      numberedContent,
      textFromEditor,
      selectionRange,
      projectFiles,
      currentFilePath: normalizedCurrentFilePath,
    };

    // Tool execution context
    const toolContext = {
      agentContext,
      intent,
      collectedEdits,
      writeEvent,
    };

    // Build system prompt
    const systemPrompt = buildSystemPrompt(
      numberedContent,
      textFromEditor,
      selectionRange,
      projectFiles,
      normalizedCurrentFilePath
    );

    // Initialize conversation with system prompt, previous messages, and current user message
    const conversationMessages: CERNLiteLLMMessage[] = [
      { role: 'system', content: systemPrompt },
      ...previousMessages,
      { role: 'user', content: userText },
    ];

    writeEvent('status', { state: 'started' });

    let finalText = '';
    let iteration = 0;

    // ========================================================================
    // Agentic Loop
    // ========================================================================
    while (iteration < MAX_AGENT_ITERATIONS) {
      iteration++;
      console.log(`[CERN LiteLLM Agent] Iteration ${iteration}`);

      // Build request
      const request: CERNLiteLLMRequest = {
        messages: conversationMessages,
        model: CERN_LITELLM_MODEL,
        max_tokens: 8192,
        temperature: 0.1,
        n: 1,
        tools: getToolDefinitions(),
        tool_choice: 'auto',
      };

      // Call CERN LiteLLM with streaming
      let response: CERNLiteLLMResponse;
      try {
        response = await callCERNLiteLLMStreaming(request, (chunk) => {
          // Stream text chunks to client immediately
          finalText += chunk;
          writeEvent('assistant_partial', { text: chunk });
        });
      } catch (error) {
        const errMsg =
          error instanceof Error ? error.message : 'Unknown CERN LiteLLM error';
        console.error('[CERN LiteLLM Agent] API error:', errMsg);
        writeEvent('error', { message: errMsg });
        break;
      }

      console.log(
        '[CERN LiteLLM Agent] Received response:',
        JSON.stringify(response, null, 2)
      );

      // Extract content and tool calls
      const textContent = extractTextContent(response);
      console.log('[CERN LiteLLM Agent] Extracted text content:', textContent);
      const toolCalls = extractToolCalls(response);
      console.log('[CERN LiteLLM Agent] Extracted tool calls:', toolCalls);
      console.log('[CERN LiteLLM Agent] isComplete:', isComplete(response));

      // Update finalText if there's new content
      if (textContent && textContent !== finalText) {
        finalText = textContent;
      }

      // Check if we're done (no tool calls, stop reason)
      if (isComplete(response) && toolCalls.length === 0) {
        console.log('[CERN LiteLLM Agent] Complete - no more tool calls');
        break;
      }

      // Process tool calls
      if (toolCalls.length > 0) {
        console.log(
          `[CERN LiteLLM Agent] Processing ${toolCalls.length} tool call(s)`
        );

        // Add assistant message with tool calls to conversation
        conversationMessages.push({
          role: 'assistant',
          content: textContent || '',
          tool_calls: toolCalls,
        });

        // Execute each tool call and collect results
        for (const toolCall of toolCalls) {
          const toolName = toolCall.function.name;
          let toolArgs: Record<string, unknown> = {};

          try {
            toolArgs = JSON.parse(toolCall.function.arguments || '{}');
          } catch (parseError) {
            console.warn(
              `[CERN LiteLLM Agent] Failed to parse tool arguments for ${toolName}`
            );
          }

          console.log(`[CERN LiteLLM Agent] Executing tool: ${toolName}`);

          const result = executeToolCall(
            toolName,
            toolArgs,
            toolCall.id,
            toolContext
          );

          // Add tool result to conversation
          conversationMessages.push({
            role: 'tool',
            tool_call_id: toolCall.id,
            content: result.content,
          });
        }

        // optional delay between tool calls to avoid rate limits
        if (TOOL_CALL_DELAY_MS > 0) {
          await sleep(TOOL_CALL_DELAY_MS);
        }
      } else if (!isComplete(response)) {
        // No tool calls but not complete - unusual, break to avoid infinite loop
        console.warn(
          '[CERN LiteLLM Agent] No tool calls but not complete, breaking loop'
        );
        break;
      }
    }

    if (iteration >= MAX_AGENT_ITERATIONS) {
      console.warn('[CERN LiteLLM Agent] Reached max iterations');
      writeEvent('error', { message: 'Agent reached maximum iteration limit' });
    }

    // Send final response (text only, edits already sent individually)
    writeEvent('done', { text: finalText });
    res.end();
  } catch (error) {
    console.error('[CERN LiteLLM Agent] Error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';

    // Try to send error event if headers not sent
    if (!res.headersSent) {
      res
        .status(500)
        .json({ error: 'Failed to process agent request', details: message });
    } else {
      res.write(`event: error\n`);
      res.write(`data: ${JSON.stringify({ message })}\n\n`);
      res.end();
    }
  }
});

// Health check endpoint
app.get('/health', (_req: express.Request, res: express.Response) => {
  res.json({
    status: 'ok',
    service: 'cern-litellm-agent',
    model: CERN_LITELLM_MODEL,
    configured: !!CERN_LITELLM_API_KEY,
  });
});

// ============================================================================
// Start Server
// ============================================================================

const PORT = process.env.PORT || 8787;
app.listen(PORT, () => {
  console.log(`[CERN LiteLLM Agent] Service listening on :${PORT}`);
  console.log(`[CERN LiteLLM Agent] Model: ${CERN_LITELLM_MODEL}`);
  console.log(`[CERN LiteLLM Agent] Base URL: ${CERN_LITELLM_URL}`);
  console.log(
    `[CERN LiteLLM Agent] API Key configured: ${!!CERN_LITELLM_API_KEY}`
  );
});
