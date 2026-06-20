import axios from 'axios';
import { ResearchData, Lead } from '../types';
import { config } from '../config';

export async function runNewsAgent(lead: Lead): Promise<ResearchData> {
  const query = lead.company || lead.name;
  if (!query) {
    return { source: 'news', raw: '', citations: [], skipped: true };
  }

  if (config.serpapiKey) {
    return fetchViaSerpApi(query);
  }

  return fetchViaFreeSearch(query);
}

async function fetchViaSerpApi(query: string): Promise<ResearchData> {
  try {
    const response = await axios.get('https://serpapi.com/search', {
      params: {
        q: `${query} news`,
        tbm: 'nws',
        num: 10,
        api_key: config.serpapiKey,
      },
      timeout: 10000,
    });

    const results = response.data.news_results || [];
    const items = results.slice(0, 8).map((r: { title: string; snippet?: string; source?: string; date?: string; link?: string }) => ({
      title: r.title,
      snippet: r.snippet,
      source: r.source,
      date: r.date,
      url: r.link,
    }));

    const raw = items
      .map((r: { title: string; snippet?: string; source?: string; date?: string }) => `[${r.date || 'Recent'}] ${r.title}\n${r.snippet || ''}\nSource: ${r.source || 'Unknown'}`)
      .join('\n\n---\n\n');

    const citations = items.map((r: { title: string; url?: string }) => ({ text: r.title, url: r.url }));

    return { source: 'news', raw, citations };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    // 401 = invalid key, 403 = quota exceeded — treat both as "no usable key"
    const status = (err as { response?: { status?: number } })?.response?.status;
    if (status === 401 || status === 403) {
      return { source: 'news', raw: '', citations: [], skipped: true };
    }
    return { source: 'news', raw: '', citations: [], error: `SerpAPI error: ${message}` };
  }
}

async function fetchViaFreeSearch(query: string): Promise<ResearchData> {
  // Without an API key, return a stub with instructions
  return {
    source: 'news',
    raw: `News search for "${query}" requires SERPAPI_KEY. Add it to .env to enable real news research.`,
    citations: [],
    skipped: true,
  };
}
