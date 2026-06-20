import axios from 'axios';
import { ResearchData, Lead } from '../types';
import { config } from '../config';

export async function runYouTubeAgent(lead: Lead): Promise<ResearchData> {
  const query = lead.youtubeChannel || lead.company || lead.name;
  if (!query) {
    return { source: 'youtube', raw: '', citations: [], skipped: true };
  }

  if (!config.youtubeApiKey) {
    return {
      source: 'youtube',
      raw: `YouTube research for "${query}" requires YOUTUBE_API_KEY. Add it to .env to enable.`,
      citations: [],
      skipped: true,
    };
  }

  try {
    const searchResp = await axios.get('https://www.googleapis.com/youtube/v3/search', {
      params: {
        q: query,
        type: 'video',
        order: 'relevance',
        maxResults: 5,
        part: 'snippet',
        key: config.youtubeApiKey,
      },
      timeout: 10000,
    });

    const items = searchResp.data.items || [];
    const videos = items.map((item: {
      id: { videoId: string };
      snippet: { title: string; description?: string; channelTitle?: string; publishedAt?: string };
    }) => ({
      title: item.snippet.title,
      description: item.snippet.description,
      channel: item.snippet.channelTitle,
      publishedAt: item.snippet.publishedAt,
      url: `https://youtube.com/watch?v=${item.id.videoId}`,
      videoId: item.id.videoId,
    }));

    const raw = videos
      .map((v: { title: string; channel?: string; publishedAt?: string; description?: string }) =>
        `Title: ${v.title}\nChannel: ${v.channel}\nPublished: ${v.publishedAt}\nDescription: ${v.description?.slice(0, 200)}`,
      )
      .join('\n\n---\n\n');

    const citations = videos.map((v: { title: string; url: string }) => ({ text: v.title, url: v.url }));

    return { source: 'youtube', raw, citations };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    // 400 = bad/missing key, 401/403 = auth failure — treat as "no usable key"
    const status = (err as { response?: { status?: number } })?.response?.status;
    if (status === 400 || status === 401 || status === 403) {
      return { source: 'youtube', raw: '', citations: [], skipped: true };
    }
    return { source: 'youtube', raw: '', citations: [], error: `YouTube API error: ${message}` };
  }
}
