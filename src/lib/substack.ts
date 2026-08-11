import { substackFeed } from '../consts';

export interface FeedItem {
  title: string;
  link: string;
  description: string;
  pubDate: Date;
}

const firstMatch = (xml: string, tag: string): string => {
  const m = xml.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, 'i'));
  return m ? m[1] : '';
};

const unwrap = (s: string): string =>
  s
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/<[^>]+>/g, '')
    .replace(/&#(\d+);/g, (_, d) => String.fromCharCode(+d))
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#8217;/g, '’')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

/**
 * Fetch the newest Substack posts at build time.
 *
 * Deliberately forgiving: the publication may not exist yet, and a network
 * hiccup during a scheduled rebuild must never fail the build. Callers fall
 * back to the local archive when this returns an empty array.
 */
export async function getSubstackPosts(limit = 3): Promise<FeedItem[]> {
  const feed = substackFeed();
  if (!feed) return [];

  try {
    const res = await fetch(feed, { signal: AbortSignal.timeout(10_000) });
    if (!res.ok) {
      console.warn(`[substack] feed returned ${res.status}; falling back to archive`);
      return [];
    }

    const xml = await res.text();
    const items = xml.split(/<item[\s>]/).slice(1, limit + 1);

    return items
      .map((raw) => {
        const pub = unwrap(firstMatch(raw, 'pubDate'));
        return {
          title: unwrap(firstMatch(raw, 'title')),
          link: unwrap(firstMatch(raw, 'link')),
          description: unwrap(firstMatch(raw, 'description')).slice(0, 200),
          pubDate: pub ? new Date(pub) : new Date(),
        };
      })
      .filter((i) => i.title && i.link);
  } catch (err) {
    console.warn(`[substack] feed unavailable (${(err as Error).message}); falling back to archive`);
    return [];
  }
}
