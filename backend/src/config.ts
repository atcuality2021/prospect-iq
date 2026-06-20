import dotenv from 'dotenv';
dotenv.config();

type LLMProvider = 'openai' | 'anthropic';

const rawProvider = (process.env.LLM_PROVIDER || 'openai').toLowerCase();
const provider: LLMProvider = rawProvider === 'anthropic' ? 'anthropic' : 'openai';

export const config = {
  port: parseInt(process.env.PORT || '3001', 10),
  mongoUri: process.env.MONGODB_URI || 'mongodb://localhost:27017/prospect-iq',
  redisUrl: process.env.REDIS_URL || 'redis://localhost:6379',

  provider,

  openaiApiKey: process.env.OPENAI_API_KEY || '',
  openaiBaseUrl: process.env.OPENAI_BASE_URL || undefined,
  openaiModel: process.env.OPENAI_MODEL || 'gpt-4o',

  anthropicApiKey: process.env.ANTHROPIC_API_KEY || '',
  anthropicModel: process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-6',

  serpapiKey: process.env.SERPAPI_KEY || '',
  youtubeApiKey: process.env.YOUTUBE_API_KEY || '',
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:3000',
};
