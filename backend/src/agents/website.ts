import axios from 'axios';
import * as cheerio from 'cheerio';
import { ResearchData, Lead } from '../types';

export async function runWebsiteAgent(lead: Lead): Promise<ResearchData> {
  const url = lead.url;
  if (!url) {
    return { source: 'website', raw: '', citations: [], skipped: true };
  }

  try {
    const response = await axios.get(url, {
      timeout: 10000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; ProspectIQ-Bot/1.0)',
      },
      maxRedirects: 5,
    });

    const $ = cheerio.load(response.data);

    // Remove noise
    $('script, style, nav, footer, header, .cookie, #cookie, [class*="banner"]').remove();

    const title = $('title').text().trim();
    const description = $('meta[name="description"]').attr('content') || '';
    const ogDescription = $('meta[property="og:description"]').attr('content') || '';

    const headings: string[] = [];
    $('h1, h2, h3').each((_, el) => {
      const text = $(el).text().trim();
      if (text) headings.push(text);
    });

    const paragraphs: string[] = [];
    $('p').each((_, el) => {
      const text = $(el).text().trim();
      if (text.length > 50) paragraphs.push(text);
    });

    const raw = [
      `Title: ${title}`,
      `Description: ${description || ogDescription}`,
      `Headings:\n${headings.slice(0, 15).join('\n')}`,
      `Content:\n${paragraphs.slice(0, 20).join('\n\n')}`,
    ].join('\n\n');

    return {
      source: 'website',
      raw,
      citations: [{ text: title || url, url }],
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return {
      source: 'website',
      raw: '',
      citations: [],
      error: `Failed to fetch website: ${message}`,
    };
  }
}
