/**
 * Safely quote a value for use in a POSIX shell command.
 * Wraps in single quotes and escapes embedded single quotes.
 */
export function shellQuote(value: string): string {
  return `'${value.replace(/'/g, `'\\''`)}'`;
}
