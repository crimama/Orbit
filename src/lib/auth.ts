import { timingSafeEqual } from "crypto";

/**
 * Constant-time token comparison to prevent timing attacks.
 * Uses crypto.timingSafeEqual under the hood.
 */
export function safeTokenCompare(
  supplied: string,
  expected: string,
): boolean {
  if (!supplied || !expected) return false;
  const a = Buffer.from(supplied);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
