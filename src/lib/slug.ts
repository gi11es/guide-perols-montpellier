export function slugify(input: string): string {
  return input
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')    // strip diacritics (combining marks)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')        // non-alnum → hyphen
    .replace(/^-+|-+$/g, '');           // trim hyphens
}
