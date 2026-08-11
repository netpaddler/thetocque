import type { ImageMetadata } from 'astro';

import libertyCrewSweatshirt from '../assets/merch/liberty-crew-sweatshirt.webp';
import mensHeavyweightTeeGold from '../assets/merch/mens-heavyweight-tee-gold.webp';
import mensHeavyweightTeeRoyalBlue from '../assets/merch/mens-heavyweight-tee-royal-blue.webp';
import unisexFreedomHoodie from '../assets/merch/unisex-freedom-hoodie.webp';
import unisexFreedomHoodieGold from '../assets/merch/unisex-freedom-hoodie-gold.webp';
import womensTee from '../assets/merch/womens-tee-soft-fabric-hard-truth.webp';

export interface Product {
  /** Product name, kept identical to the Printful store so nothing looks
   *  renamed when a visitor clicks through. */
  name: string;
  /** Lowest variant price. Printful shows these as "From $X". */
  priceFrom: string;
  /** Deep link to the individual product, not the store index. */
  href: string;
  image: ImageMetadata;
  alt: string;
}

const STORE = 'https://justweights.printful.me';

/**
 * Mirrored from the Printful storefront on 2026-08-11. Printful blocks
 * server-side requests, so this cannot be fetched at build time — if products
 * or prices change, update this list and re-run the image transfer.
 */
export const PRODUCTS: Product[] = [
  {
    name: 'Unisex Freedom Hoodie',
    priceFrom: '$43.00',
    href: `${STORE}/product/unisex-hoodie-copy`,
    image: unisexFreedomHoodie,
    alt: 'Gold pullover hoodie printed with the Just Weights balance-scale graphic and the line justweights.org, Proverbs 11:1',
  },
  {
    name: 'Unisex Freedom Hoodie (Gold)',
    priceFrom: '$43.00',
    href: `${STORE}/product/unisex-hoodie-gold`,
    image: unisexFreedomHoodieGold,
    alt: 'A person wearing a black Just Weights tee under a cream jacket, with black trousers and white trainers',
  },
  {
    name: 'Liberty Crew neck sweatshirt',
    priceFrom: '$32.00',
    href: `${STORE}/product/liberty-crew-neck-sweatshirt`,
    image: libertyCrewSweatshirt,
    alt: 'White crew neck sweatshirt with a small purple Tocqueville Liberty Institute sunburst emblem on the chest',
  },
  {
    name: 'Men’s Premium Heavyweight Tee (Gold)',
    priceFrom: '$31.50',
    href: `${STORE}/product/mens-premium-heavyweight-tee-gold`,
    image: mensHeavyweightTeeGold,
    alt: 'Black heavyweight t-shirt with a small gold Tocqueville Liberty Institute sunburst emblem on the chest',
  },
  {
    name: 'Men’s Premium Heavyweight Tees (Royal Blue)',
    priceFrom: '$31.50',
    href: `${STORE}/product/mens-premium-heavyweight-tee-copy`,
    image: mensHeavyweightTeeRoyalBlue,
    alt: 'Heather grey heavyweight t-shirt with a small purple Tocqueville Liberty Institute sunburst emblem on the chest',
  },
  {
    name: 'Just Weights Women’s Tee – Soft Fabric, Hard Truth',
    priceFrom: '$26.00',
    href: `${STORE}/product/just-weights-womens-tee-soft-fabric-hard-truth`,
    image: womensTee,
    alt: 'Coral women’s t-shirt with a small purple Tocqueville Liberty Institute sunburst emblem on the chest',
  },
];
