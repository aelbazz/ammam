/**
 * "<FullName>-CV.<ext>", alphanumeric and hyphen only. No filesystem path is ever built from
 * this - generated files are produced in memory and streamed directly in the HTTP response,
 * never written to disk - so path traversal is structurally impossible here, not just
 * filtered against.
 */
export function sanitizeForFilename(fullName: string): string {
  const cleaned = fullName
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^A-Za-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
  return cleaned || 'CV';
}
