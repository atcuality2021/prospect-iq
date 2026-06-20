import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';
import { config } from '../config';

export interface UnifiedMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface UnifiedTool {
  name: string;
  description: string;
  schema: {
    type: 'object';
    properties: Record<string, unknown>;
    required: string[];
  };
}

// --- OpenAI adapter (also handles OpenAI-compatible local endpoints) ---

const openai = new OpenAI({
  apiKey: config.openaiApiKey,
  ...(config.openaiBaseUrl && { baseURL: config.openaiBaseUrl }),
});

// extra_body disables chain-of-thought for Qwen3 thinking models;
// ignored silently by standard OpenAI endpoints
const NO_THINKING = { chat_template_kwargs: { enable_thinking: false } };

async function openaiCallWithTool<T>(
  messages: UnifiedMessage[],
  tool: UnifiedTool,
  maxTokens: number,
): Promise<T> {
  const resp = await openai.chat.completions.create({
    model: config.openaiModel,
    max_tokens: maxTokens,
    messages: messages.map((m) => ({ role: m.role, content: m.content })),
    tools: [
      {
        type: 'function',
        function: { name: tool.name, description: tool.description, parameters: tool.schema },
      },
    ],
    tool_choice: { type: 'function', function: { name: tool.name } },
    // @ts-expect-error — vLLM extension field, not in OpenAI types
    extra_body: NO_THINKING,
  });

  const toolCall = resp.choices[0]?.message?.tool_calls?.[0];
  if (!toolCall || toolCall.type !== 'function') {
    throw new Error(`OpenAI: no tool call returned for "${tool.name}"`);
  }
  return JSON.parse(toolCall.function.arguments) as T;
}

async function openaiCallText(messages: UnifiedMessage[], maxTokens: number): Promise<string> {
  const resp = await openai.chat.completions.create({
    model: config.openaiModel,
    max_tokens: maxTokens,
    messages: messages.map((m) => ({ role: m.role, content: m.content })),
    // @ts-expect-error — vLLM extension field
    extra_body: NO_THINKING,
  });
  return resp.choices[0]?.message?.content ?? '';
}

// --- Anthropic adapter ---

const anthropic = new Anthropic({ apiKey: config.anthropicApiKey });

async function anthropicCallWithTool<T>(
  messages: UnifiedMessage[],
  tool: UnifiedTool,
  maxTokens: number,
): Promise<T> {
  const resp = await anthropic.messages.create({
    model: config.anthropicModel,
    max_tokens: maxTokens,
    tools: [{ name: tool.name, description: tool.description, input_schema: tool.schema }],
    tool_choice: { type: 'tool', name: tool.name },
    messages: messages.map((m) => ({ role: m.role, content: m.content })),
  });

  const toolUse = resp.content.find((c) => c.type === 'tool_use');
  if (!toolUse || toolUse.type !== 'tool_use') {
    throw new Error(`Anthropic: no tool use returned for "${tool.name}"`);
  }
  return toolUse.input as T;
}

async function anthropicCallText(messages: UnifiedMessage[], maxTokens: number): Promise<string> {
  const resp = await anthropic.messages.create({
    model: config.anthropicModel,
    max_tokens: maxTokens,
    messages: messages.map((m) => ({ role: m.role, content: m.content })),
  });
  return resp.content
    .filter((c): c is Anthropic.TextBlock => c.type === 'text')
    .map((c) => c.text)
    .join('');
}

// --- Unified exports ---

export async function callWithTool<T>(
  messages: UnifiedMessage[],
  tool: UnifiedTool,
  maxTokens = 2000,
): Promise<T> {
  return config.provider === 'anthropic'
    ? anthropicCallWithTool<T>(messages, tool, maxTokens)
    : openaiCallWithTool<T>(messages, tool, maxTokens);
}

export async function callText(messages: UnifiedMessage[], maxTokens = 800): Promise<string> {
  return config.provider === 'anthropic'
    ? anthropicCallText(messages, maxTokens)
    : openaiCallText(messages, maxTokens);
}
