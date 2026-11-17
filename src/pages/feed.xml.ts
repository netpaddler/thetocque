import rss from '@astrojs/rss';
import { getCollection } from 'astro:content';
import type { APIContext } from 'astro';
import { SITE } from '../consts';

/**
 * Archive RSS. Emitted at /feed.xml. The build copies it to
 * dist/feed/index.xml, which GitHub Pages serves at /feed/ as
 * application/xml, and to dist/rss.xml so /rss.xml still returns the feed.
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
