/**
 * Type definitions for CERN LiteLLM API
 * Based on the OpenAI-compatible response format
 */

// ============================================================================
// Request Types
// ============================================================================

export interface CERNLiteLLMMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string | CERNLiteLLMContentPart[];
  tool_calls?: CERNLiteLLMToolCall[];
  tool_call_id?: string;
  name?: string;
}

export interface CERNLiteLLMContentPart {
  type: 'text' | 'image_url';
  text?: string;
  image_url?: {
    url: string;
  };
}

export interface CERNLiteLLMToolCall {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string; // JSON string
  };
}

export interface CERNLiteLLMToolDefinition {
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

export interface CERNLiteLLMRequest {
  messages: CERNLiteLLMMessage[];
  model: string;
  max_tokens?: number;
  temperature?: number;
  n?: number;
  tools?: CERNLiteLLMToolDefinition[];
  tool_choice?:
    | 'auto'
    | 'none'
    | { type: 'function'; function: { name: string } };
}

// ============================================================================
// Response Types
// ============================================================================

export interface CERNLiteLLMResponse {
  steps: CERNLiteLLMStep[];
}

export interface CERNLiteLLMStep {
  content: CERNLiteLLMContentPart[];
  finishReason: 'stop' | 'tool_calls' | 'length' | 'content_filter';
  usage: CERNLiteLLMUsage;
  warnings: unknown[];
  request: {
    body: CERNLiteLLMRequest;
  };
  response: CERNLiteLLMInnerResponse;
  providerMetadata?: unknown;
}

export interface CERNLiteLLMUsage {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
}

export interface CERNLiteLLMInnerResponse {
  id: string;
  timestamp: string;
  modelId: string;
  body: CERNLiteLLMResponseBody;
  messages: CERNLiteLLMMessage[];
}

export interface CERNLiteLLMResponseBody {
  choices: CERNLiteLLMChoice[];
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

export interface CERNLiteLLMChoice {
  finish_reason: 'stop' | 'tool_calls' | 'length' | 'content_filter';
  index: number;
  logprobs: unknown;
  message: CERNLiteLLMChoiceMessage;
}

export interface CERNLiteLLMChoiceMessage {
  content: string | null;
  reasoning?: string;
  role: 'assistant';
  tool_calls?: CERNLiteLLMToolCall[];
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
