import rss from '@astrojs/rss';
import { getCollection } from 'astro:content';
import type { APIContext } from 'astro';
import { SITE } from '../consts';

/**
 * Archive RSS. Emitted at /feed.xml.
 * Firebase rewrites /feed and /feed/ to this file (see firebase.json).
 * GitHub Pages has no rewrites; the build copies this file to
 * dist/feed/index.xml, which Pages serves at /feed/ as application/xml,
 * and to dist/rss.xml so /rss.xml still returns the feed.
 */
export async function GET(context: APIContext) {
  const posts = (await getCollection('blog')).sort(
    (a, b) => b.data.pubDate.valueOf() - a.data.pubDate.valueOf(),
  );

  return rss({
    title: `${SITE.name} — Essays`,
    description: SITE.description,
    site: context.site ?? SITE.url,
    items: posts.map((post) => ({
      title: post.data.title,
      description: post.data.description,
      pubDate: post.data.pubDate,
      link: post.data.permalink,
    })),
    customData: '<language>en-us</language>',
  });
}
