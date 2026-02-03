/**
 * Template Config Loader (Agent Server)
 *
 * Dynamically loads template configurations from /report-templates/<template-id>/config.ts
 * Uses relative imports that work with tsx runtime
 */

import type { EditPattern } from '@report-templates/report-init-types';

// ============================================================================
// TYPES
// ============================================================================

export interface TemplateConfig {
  TEMPLATE_METADATA: {
    id: string; // Must match the folder name in /report-templates/
    name: string;
    description: string;
    hasInitConfig: boolean;
  };
  INIT_TARGET_FILES: readonly string[];
  EDIT_PATTERNS: ReadonlyArray<EditPattern>;
  INITIAL_REPORT_STATE?: Record<string, unknown>;
  INITIAL_STATE?: Record<string, unknown>;
}

// ============================================================================
// CONFIG LOADING
// ============================================================================

/**
 * Load template config dynamically
 * Returns null if template doesn't exist or has no config
 *
 * Note: Uses relative path imports to work with tsx runtime
 */
export async function loadTemplateConfig(
  templateId: string | null | undefined
): Promise<TemplateConfig | null> {
  if (!templateId) return null;

  try {
    // Use relative path that works with tsx
    const config = await import(
      `../../report-templates/${templateId}/config.ts`
    );
    return config as TemplateConfig;
  } catch (error) {
    console.error(
      `[template-config] Failed to load config for ${templateId}:`,
      error
    );
    return null;
  }
}

// ============================================================================
// CONVENIENCE ACCESSORS
// ============================================================================

export async function getTemplateTargetFiles(
  templateId: string | null | undefined
): Promise<readonly string[]> {
  const config = await loadTemplateConfig(templateId);
  return config?.INIT_TARGET_FILES || [];
}

export async function getTemplateEditPatterns(
  templateId: string | null | undefined
): Promise<ReadonlyArray<EditPattern>> {
  const config = await loadTemplateConfig(templateId);
  return config?.EDIT_PATTERNS || [];
}
