import { prisma } from "@/lib/prisma";
import {
  DEFAULT_DANGEROUS_PATTERNS,
  DEFAULT_SAFE_PATTERNS,
  DEFAULT_INTERCEPTOR_MODE,
} from "@/lib/constants";
import type { InterceptorRuleInfo, InterceptorMode } from "@/lib/types";

let seeded = false;

/**
 * Seed default interceptor rules (dangerous + safe patterns).
 * On first run: inserts all. On subsequent runs: adds missing allow rules.
 */
export async function seedInterceptorRules(): Promise<void> {
  if (seeded) return;

  const count = await prisma.interceptorRule.count();

  if (count === 0) {
    // First run — seed both dangerous and safe patterns
    const allPatterns = [
      ...DEFAULT_DANGEROUS_PATTERNS.map((p) => ({
        pattern: p.pattern,
        description: p.description,
        severity: p.severity,
      })),
      ...DEFAULT_SAFE_PATTERNS.map((p) => ({
        pattern: p.pattern,
        description: p.description,
        severity: p.severity,
      })),
    ];

    await prisma.interceptorRule.createMany({ data: allPatterns });
    console.log(`[Interceptor] Seeded ${allPatterns.length} default rules`);
  } else {
    // Existing DB — add missing allow rules
    const allowCount = await prisma.interceptorRule.count({
      where: { severity: "allow" },
    });

    if (allowCount === 0) {
      await prisma.interceptorRule.createMany({
        data: DEFAULT_SAFE_PATTERNS.map((p) => ({
          pattern: p.pattern,
          description: p.description,
          severity: p.severity,
        })),
      });
      console.log(
        `[Interceptor] Added ${DEFAULT_SAFE_PATTERNS.length} allow rules to existing DB`,
      );
    }
  }

  seeded = true;
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

/**
 * Get the current interceptor mode (singleton config).
 */
export async function getInterceptorMode(): Promise<InterceptorMode> {
  const config = await prisma.interceptorConfig.findUnique({
    where: { id: "singleton" },
  });
  return (config?.mode as InterceptorMode) ?? DEFAULT_INTERCEPTOR_MODE;
}

/**
 * Set the interceptor mode.
 */
export async function setInterceptorMode(
  mode: InterceptorMode,
): Promise<void> {
  await prisma.interceptorConfig.upsert({
    where: { id: "singleton" },
    update: { mode },
    create: { id: "singleton", mode },
  });
}
