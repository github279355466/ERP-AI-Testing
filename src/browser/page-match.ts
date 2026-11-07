export interface PageLike {
  url(): string;
}

export interface PageCriteria {
  urlIncludes?: string;
  urlPattern?: RegExp;
  titleIncludes?: string;
  prefer?: 'first' | 'last';
}

export function hostOf(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return '';
  }
}

export function isLowcodePage(url: string, lowcodeHost: string): boolean {
  return hostOf(url) === lowcodeHost;
}

export function isPortalPage(url: string, portalHost: string): boolean {
  return hostOf(url) === portalHost;
}

export function matchesUrl(url: string, criteria: PageCriteria): boolean {
  if (criteria.urlIncludes && !url.includes(criteria.urlIncludes)) return false;
  if (criteria.urlPattern && !criteria.urlPattern.test(url)) return false;
  return true;
}

export function pickPage<T extends PageLike>(pages: readonly T[], criteria: PageCriteria): T | undefined {
  const candidates = pages.filter((page) => matchesUrl(page.url(), criteria));
  if (candidates.length === 0) return undefined;
  return criteria.prefer === 'last' ? candidates[candidates.length - 1] : candidates[0];
}

export async function pickPageByTitle<T extends PageLike & { title(): Promise<string> }>(
  pages: readonly T[],
  criteria: PageCriteria,
): Promise<T | undefined> {
  const byUrl = pickPage(pages, criteria);
  if (!criteria.titleIncludes) return byUrl;

  const pool = criteria.urlIncludes || criteria.urlPattern ? pages.filter((page) => matchesUrl(page.url(), criteria)) : pages;
  for (const page of pool) {
    const title = await page.title().catch(() => '');
    if (title.includes(criteria.titleIncludes)) return page;
  }
  return byUrl;
}
