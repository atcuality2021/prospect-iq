import axios from 'axios';
import * as cheerio from 'cheerio';
import { ResearchData, Lead } from '../types';

export async function runLinkedInAgent(lead: Lead): Promise<ResearchData> {
  const linkedinUrl = lead.linkedinUrl;
  if (!linkedinUrl) {
    return { source: 'linkedin', raw: '', citations: [], skipped: true };
  }

  try {
    const response = await axios.get(linkedinUrl, {
      timeout: 8000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept-Language': 'en-US,en;q=0.9',
      },
      maxRedirects: 3,
    });

    const $ = cheerio.load(response.data);
    const title = $('title').text().trim();
    const description = $('meta[name="description"]').attr('content') || '';
    const ogTitle = $('meta[property="og:title"]').attr('content') || '';
    const ogDescription = $('meta[property="og:description"]').attr('content') || '';

    const raw = [
      ogTitle || title,
      ogDescription || description,
    ].filter(Boolean).join('\n\n');

    if (!raw.trim()) {
      return {
        source: 'linkedin',
        raw: `LinkedIn profile: ${linkedinUrl} (limited public access)`,
        citations: [{ text: 'LinkedIn Profile', url: linkedinUrl }],
      };
    }

    return {
      source: 'linkedin',
      raw,
      citations: [{ text: ogTitle || title, url: linkedinUrl }],
    };
  } catch {
    return {
      source: 'linkedin',
      raw: `LinkedIn profile available at: ${linkedinUrl} (access restricted)`,
      citations: [{ text: 'LinkedIn Profile', url: linkedinUrl }],
      error: 'LinkedIn access restricted — using profile URL as signal',
    };
  }
}
