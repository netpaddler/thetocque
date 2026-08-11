/**
 * Compose the default social sharing card (1200x630).
 *
 * Social platforms crop square images unpredictably; the old WordPress site
 * shared a 200x200 favicon, which rendered as a tiny logo on every link. This
 * builds a proper landscape card from the existing brand artwork, so no font
 * needs to be installed on the machine running it.
 *
 *   node scripts/make-og-image.mjs
 */
import sharp from 'sharp';
import { mkdir } from 'node:fs/promises';

const W = 1200;
const H = 630;
const PURPLE = '#7924c0';

const WORDMARK_W = 880;

const wordmark = await sharp('src/assets/site/logo-wordmark.png')
  .resize({ width: WORDMARK_W, withoutEnlargement: false })
  .toBuffer();
const { height: wordmarkH = 0 } = await sharp(wordmark).metadata();

/**
 * The emblem artwork is a photo of a logo printed on paper, complete with a
 * desk and pencils around the edges — any crop of it looks like a mistake at
 * card size. The wordmark alone reads cleanly, so the card is just that plus
 * brand rules.
 */
const rules = Buffer.from(
  `<svg width="${W}" height="${H}">
     <rect x="0" y="0" width="${W}" height="14" fill="${PURPLE}"/>
     <rect x="0" y="${H - 14}" width="${W}" height="14" fill="${PURPLE}"/>
   </svg>`,
);

await mkdir('public', { recursive: true });

await sharp({
  create: { width: W, height: H, channels: 4, background: '#ffffff' },
})
  .composite([
    { input: rules, top: 0, left: 0 },
    {
      input: wordmark,
      top: Math.round((H - wordmarkH) / 2),
      left: Math.round((W - WORDMARK_W) / 2),
    },
  ])
  .png()
  .toFile('public/og-image.png');

console.log(`og-image.png written (${W}x${H}, wordmark ${WORDMARK_W}x${wordmarkH})`);
