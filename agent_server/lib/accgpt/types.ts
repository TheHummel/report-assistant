/**
 * Type definitions for ACCGPT API
 * Based on the Groq-compatible response format
 */

// ============================================================================
// Request Types
// ============================================================================

export interface ACCGPTMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string | ACCGPTContentPart[];
  tool_calls?: ACCGPTToolCall[];
  tool_call_id?: string;
  name?: string;
}

export interface ACCGPTContentPart {
  type: 'text';
  text: string;
}

export interface ACCGPTToolCall {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string; // JSON string
  };
}

export interface ACCGPTToolDefinition {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: {
      type: 'object';
      properties: Record<string, unknown>;
      required?: string[];
    };
  };
}

export interface ACCGPTRequest {
  messages: ACCGPTMessage[];
  model: string;
  max_tokens?: number;
  temperature?: number;
  n?: number;
  tools?: ACCGPTToolDefinition[];
  tool_choice?:
    | 'auto'
    | 'none'
    | { type: 'function'; function: { name: string } };
}

// ============================================================================
// Response Types
// ============================================================================

export interface ACCGPTResponse {
  steps: ACCGPTStep[];
}

export interface ACCGPTStep {
  content: ACCGPTContentPart[];
  finishReason: 'stop' | 'tool_calls' | 'length' | 'content_filter';
  usage: ACCGPTUsage;
  warnings: unknown[];
  request: {
    body: ACCGPTRequest;
  };
  response: ACCGPTInnerResponse;
  providerMetadata?: unknown;
}

export interface ACCGPTUsage {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
}

export interface ACCGPTInnerResponse {
  id: string;
  timestamp: string;
  modelId: string;
  body: ACCGPTResponseBody;
  messages: ACCGPTMessage[];
}

export interface ACCGPTResponseBody {
  choices: ACCGPTChoice[];
  created: number;
  id: string;
  model: string;
  object: 'chat.completion';
  service_tier?: string;
  system_fingerprint?: string;
  usage: {
    completion_time?: number;
    completion_tokens: number;
    prompt_time?: number;
    prompt_tokens: number;
    queue_time?: number;
    total_time?: number;
    total_tokens: number;
  };
  usage_breakdown?: unknown;
  x_groq?: { id: string };
}

export interface ACCGPTChoice {
  finish_reason: 'stop' | 'tool_calls' | 'length' | 'content_filter';
  index: number;
  logprobs: unknown;
  message: ACCGPTChoiceMessage;
}

export interface ACCGPTChoiceMessage {
  content: string | null;
  reasoning?: string;
  role: 'assistant';
  tool_calls?: ACCGPTToolCall[];
}

// ============================================================================
// Agent Context Types
// ============================================================================

export interface AgentContext {
  fileContent: string;
  numberedContent: string;
  textFromEditor?: string | null;
  selectionRange?: { startLineNumber: number; endLineNumber: number } | null;
  projectFiles?: ProjectFileContext[];
  currentFilePath?: string | null;
}

export interface ProjectFileContext {
  path: string;
  content: string;
}

export interface ToolResult {
  tool_call_id: string;
  content: string;
}
