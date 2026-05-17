export function slugify(input: string): string {
  return input
    .replace(/[Œœ]/g, 'oe')
    .replace(/[Ææ]/g, 'ae')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')    // strip diacritics (combining marks)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')        // non-alnum → hyphen
    .replace(/^-+|-+$/g, '');           // trim hyphens
}
