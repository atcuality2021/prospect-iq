import { Router, Request, Response } from 'express';
import { config } from '../config';

export const settingsRouter = Router();

const runtimeOverrides: Record<string, string> = {};

const DEFAULT_PROMPTS: Record<string, string> = {
  verification: "You are a fact-checker. Extract only claims that are directly and verbatim supported by the source text. For each verified fact include an exact quote from the source as evidence.",
  synthesis:    "You are an expert sales researcher. First reason freely about what the verified facts reveal about this prospect's strategic priorities, pain points, and buying signals. Then call the tool.",
  matching:     "You are a service matching expert. Score each service in the catalog 0-100 based on how well it addresses the prospect's verified signals and pain points.",
  pitching:     "You are an expert sales copywriter. Draft a pitch that opens with the prospect's most striking verified signal. Every sentence must earn its place — no generic language.",
  reflection:   "You are a pitch critic. Flag any sentence that could be sent to ANY prospect unchanged. Every claim must be tied to a specific verified signal from this prospect.",
};

settingsRouter.get('/', (_req: Request, res: Response) => {
  const newsEnabled    = Boolean(config.serpapiKey    && config.serpapiKey    !== 'optional');
  const youtubeEnabled = Boolean(config.youtubeApiKey && config.youtubeApiKey !== 'optional');

  res.json({
    provider:        runtimeOverrides.provider       ?? config.provider,
    openaiModel:     runtimeOverrides.openaiModel    ?? config.openaiModel,
    openaiBaseUrl:   runtimeOverrides.openaiBaseUrl  ?? config.openaiBaseUrl ?? '',
    anthropicModel:  runtimeOverrides.anthropicModel ?? config.anthropicModel,
    hasOpenAiKey:    Boolean(config.openaiApiKey    && config.openaiApiKey    !== 'optional'),
    hasAnthropicKey: Boolean(config.anthropicApiKey && config.anthropicApiKey !== 'sk-ant-...'),
    hasSerpApiKey:   newsEnabled,
    hasYoutubeKey:   youtubeEnabled,
    agents: {
      website:  { enabled: agentOverrides.website  ?? true,           description: "Scrapes the prospect website for company info"         },
      linkedin: { enabled: agentOverrides.linkedin ?? true,           description: "Fetches LinkedIn company or person page"               },
      news:     { enabled: agentOverrides.news     ?? newsEnabled,    description: "Searches recent news via SerpAPI"                     },
      youtube:  { enabled: agentOverrides.youtube  ?? youtubeEnabled, description: "Finds YouTube videos via YouTube Data API"            },
    },
    pipeline: {
      verification: { enabled: true, description: "Grounds every claim in verbatim source quotes"                                             },
      synthesis:    { enabled: true, description: "Think-before-act: reason then build structured profile"                                    },
      matching:     { enabled: true, description: "Ranks catalog services against verified signals"                                            },
      pitching:     { enabled: true, description: "Generates channel-specific outreach tied to evidence"                                      },
      reflection:   { enabled: true, qualityThreshold: reflectionThreshold, description: `Critic reviews and revises if quality < ${reflectionThreshold}` },
    },
    prompts: { ...DEFAULT_PROMPTS, ...promptOverrides },
  });
});

const agentOverrides: Record<string, boolean>   = {};
const promptOverrides: Record<string, string>    = {};
let   reflectionThreshold                        = 70;

settingsRouter.put('/', (req: Request, res: Response) => {
  const body = req.body as Record<string, unknown>;

  const llmFields = ['provider', 'openaiModel', 'anthropicModel', 'openaiBaseUrl'];
  for (const key of llmFields) {
    if (body[key] !== undefined) {
      runtimeOverrides[key] = String(body[key]);
    }
  }

  if (body.agentOverrides && typeof body.agentOverrides === 'object') {
    for (const [k, v] of Object.entries(body.agentOverrides as Record<string, boolean>)) {
      agentOverrides[k] = Boolean(v);
    }
  }

  if (typeof body.reflectionThreshold === 'number') {
    reflectionThreshold = Math.max(0, Math.min(100, body.reflectionThreshold));
  }

  if (body.promptOverrides && typeof body.promptOverrides === 'object') {
    for (const [k, v] of Object.entries(body.promptOverrides as Record<string, string>)) {
      if (typeof v === 'string') promptOverrides[k] = v;
    }
  }

  res.json({ ok: true });
});
