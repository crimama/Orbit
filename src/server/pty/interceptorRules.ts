import { prisma } from "@/lib/prisma";
import { DEFAULT_DANGEROUS_PATTERNS } from "@/lib/constants";
import type { InterceptorRuleInfo } from "@/lib/types";

let seeded = false;

/**
 * Seed default dangerous command patterns into the InterceptorRule table.
 * Only inserts if the table is empty (first run).
 */
export async function seedInterceptorRules(): Promise<void> {
  if (seeded) return;

  const count = await prisma.interceptorRule.count();
  if (count > 0) {
    seeded = true;
    return;
  }

  await prisma.interceptorRule.createMany({
    data: DEFAULT_DANGEROUS_PATTERNS.map((p) => ({
      pattern: p.pattern,
      description: p.description,
      severity: p.severity,
    })),
  });

  seeded = true;
  console.log(
    `[Interceptor] Seeded ${DEFAULT_DANGEROUS_PATTERNS.length} default rules`,
  );
}

/**
 * Query all enabled interceptor rules from the database.
 */
export async function getActiveRules(): Promise<InterceptorRuleInfo[]> {
  const rules = await prisma.interceptorRule.findMany({
    where: { enabled: true },
    orderBy: { createdAt: "asc" },
  });

  return rules.map((r) => ({
    id: r.id,
    pattern: r.pattern,
    description: r.description,
    severity: r.severity as InterceptorRuleInfo["severity"],
    enabled: r.enabled,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
  }));
}
