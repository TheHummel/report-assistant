/**
 * ACCGPT Agent Service for Octree LaTeX Editor
 *
 * Replaces the Claude Agent SDK with a custom agentic loop using ACCGPT
 * (OpenAI-compatible API with GPT-OSS model)
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
import {
  getToolDefinitions,
  executeToolCall,
  ACCGPTRequest,
  ACCGPTResponse,
  ACCGPTMessage,
  ACCGPTToolCall,
  AgentContext,
  ProjectFileContext,
} from './lib/accgpt';
import type { LineEdit } from './lib/octra-agent/line-edits';
import type { IntentResult } from './lib/octra-agent/intent-inference';

const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// ============================================================================
// Configuration
// ============================================================================

const ACCGPT_BASE_URL =
  process.env.ACC_GPT_BASE_URL || 'https://your-accgpt-endpoint.example.com';
const ACCGPT_API_KEY = process.env.CSS_API_KEY || '';
const ACCGPT_MODEL = process.env.ACCGPT_MODEL || 'openai/gpt-oss-120b';
const MAX_AGENT_ITERATIONS = 10; // Safety limit for agentic loop
const TOOL_CALL_DELAY_MS = parseInt(process.env.TOOL_CALL_DELAY_MS || '0', 10);

// ============================================================================
// Helper Functions
// ============================================================================

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function validateApiConfig(): { isValid: boolean; error?: string } {
  if (!ACCGPT_API_KEY) {
    return { isValid: false, error: 'CSS_API_KEY is not configured' };
  }
  return { isValid: true };
}

/**
 * Call ACCGPT API
 */
async function callACCGPT(request: ACCGPTRequest): Promise<ACCGPTResponse> {
  const response = await fetch(`${ACCGPT_BASE_URL}/chat`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-API-Key': ACCGPT_API_KEY,
    },
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`ACCGPT API error (${response.status}): ${errorText}`);
  }

  const data = await response.json();
  return data as ACCGPTResponse;
}

/**
 * Extract text content from ACCGPT response
 * Handles both wrapped (steps) and unwrapped (direct OpenAI) formats
 */
function extractTextContent(response: ACCGPTResponse): string {
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
 * Extract tool calls from ACCGPT response
 * Handles both wrapped (steps) and unwrapped (direct OpenAI) formats
 */
function extractToolCalls(response: ACCGPTResponse): ACCGPTToolCall[] {
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
function isComplete(response: ACCGPTResponse): boolean {
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
    } = req.body || {};

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

    // Build context (non-blocking)
    const numberedContent = await buildNumberedContent(
      fileContent,
      textFromEditor
    );
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

    // Set up SSE response
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');

    const writeEvent = (event: string, data: unknown) => {
      res.write(`event: ${event}\n`);
      res.write(`data: ${JSON.stringify(data)}\n\n`);
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
    const conversationMessages: ACCGPTMessage[] = [
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
      console.log(`[ACCGPT Agent] Iteration ${iteration}`);

      // Build request
      const request: ACCGPTRequest = {
        messages: conversationMessages,
        model: ACCGPT_MODEL,
        max_tokens: 8192,
        temperature: 0.1,
        n: 1,
        tools: getToolDefinitions(),
        tool_choice: 'auto',
      };

      // Call ACCGPT
      let response: ACCGPTResponse;
      try {
        response = await callACCGPT(request);
      } catch (error) {
        const errMsg =
          error instanceof Error ? error.message : 'Unknown ACCGPT error';
        console.error('[ACCGPT Agent] API error:', errMsg);
        writeEvent('error', { message: errMsg });
        break;
      }

      console.log(
        '[ACCGPT Agent] Received response:',
        JSON.stringify(response, null, 2)
      );

      // Extract content and tool calls
      const textContent = extractTextContent(response);
      console.log('[ACCGPT Agent] Extracted text content:', textContent);
      const toolCalls = extractToolCalls(response);
      console.log('[ACCGPT Agent] Extracted tool calls:', toolCalls);
      console.log('[ACCGPT Agent] isComplete:', isComplete(response));

      // Track text content (don't emit yet - ACCGPT returns full text, not chunks)
      if (textContent && textContent !== finalText) {
        finalText = textContent;
      }

      // Check if we're done (no tool calls, stop reason)
      if (isComplete(response) && toolCalls.length === 0) {
        console.log('[ACCGPT Agent] Complete - no more tool calls');
        break;
      }

      // Process tool calls
      if (toolCalls.length > 0) {
        console.log(
          `[ACCGPT Agent] Processing ${toolCalls.length} tool call(s)`
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
              `[ACCGPT Agent] Failed to parse tool arguments for ${toolName}`
            );
          }

          console.log(`[ACCGPT Agent] Executing tool: ${toolName}`);

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
          '[ACCGPT Agent] No tool calls but not complete, breaking loop'
        );
        break;
      }
    }

    if (iteration >= MAX_AGENT_ITERATIONS) {
      console.warn('[ACCGPT Agent] Reached max iterations');
      writeEvent('error', { message: 'Agent reached maximum iteration limit' });
    }

    // Send final response (text only, edits already sent individually)
    writeEvent('done', { text: finalText });
    res.end();
  } catch (error) {
    console.error('[ACCGPT Agent] Error:', error);
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
    service: 'accgpt-agent',
    model: ACCGPT_MODEL,
    configured: !!ACCGPT_API_KEY,
  });
});

// ============================================================================
// Start Server
// ============================================================================

const PORT = process.env.PORT || 8788;
app.listen(PORT, () => {
  console.log(`[ACCGPT Agent] Service listening on :${PORT}`);
  console.log(`[ACCGPT Agent] Model: ${ACCGPT_MODEL}`);
  console.log(`[ACCGPT Agent] Base URL: ${ACCGPT_BASE_URL}`);
  console.log(`[ACCGPT Agent] API Key configured: ${!!ACCGPT_API_KEY}`);
});
