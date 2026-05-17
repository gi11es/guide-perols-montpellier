const STORAGE_KEY = 'guide:bookmarks';

export function getBookmarks(): string[] {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]');
  } catch {
    return [];
  }
}

export function isBookmarked(slug: string): boolean {
  return getBookmarks().includes(slug);
}

export function toggleBookmark(slug: string): string[] {
  const current = getBookmarks();
  const idx = current.indexOf(slug);
  const next = idx === -1
    ? [...current, slug]
    : current.filter((s) => s !== slug);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  window.dispatchEvent(new CustomEvent('bookmark:changed', { detail: { bookmarks: next } }));
  return next;
}
