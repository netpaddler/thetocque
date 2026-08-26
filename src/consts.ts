/** Single source of truth for site-wide facts. */
export const SITE = {
  name: 'The Tocqueville Liberty Institute',
  shortName: 'TLI',
  tagline: "Reigniting America's Love Affair with Liberty",
  title: 'The Tocqueville Liberty Institute',
  description:
    'The Tocqueville Liberty Institute is a 501(c)(3) revitalizing America’s commitment to liberal democracy through civic education on our economic history, civic responsibilities, and the foundations of the republic.',
  url: 'https://thetocque.org',
  ein: '93-3863512',
  founder: 'Colonel Pete',
} as const;

export const CONTACT = {
  street: '3225 McLeod Dr Ste 100',
  city: 'Las Vegas',
  region: 'NV',
  postalCode: '89121',
  country: 'US',
  phone: '+1 (253) 655-7666',
  phoneHref: 'tel:+12536557666',
} as const;

export const LINKS = {
  donate: 'https://www.every.org/tocqueville-institute?utm_campaign=donate-link#/donate',
  merch: 'https://justweights.printful.me/',
  /**
   * Substack is the publishing home for all new essays and podcast episodes.
   * Set once the publication exists; until then subscribe CTAs are hidden and
   * the homepage "Latest" section falls back to the archived posts.
   */
  substack: 'https://mythirdlanguage.substack.com' as string,
} as const;

/** Derived from LINKS.substack so pages don't hand-roll feed URLs. */
export const substackFeed = () =>
  LINKS.substack ? `${LINKS.substack.replace(/\/$/, '')}/feed` : null;

export const NAV = [
  { href: '/blog/', label: 'Essays' },
  { href: '/about/', label: 'About' },
  { href: '/merch/', label: 'Merch' },
] as const;
