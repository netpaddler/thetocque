/** Trim to a length without slicing a word in half. */
export function truncate(input: string, max: number): string {
  const text = input.trim();
  if (text.length <= max) return text;

  const cut = text.slice(0, max);
  const lastSpace = cut.lastIndexOf(' ');
  const body = (lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : cut).replace(/[\s,;:.—-]+$/, '');

  return `${body}…`;
}
