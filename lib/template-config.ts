/**
 * Template Config Loader (Main App)
 *
 * Dynamically loads template configurations from /report-templates/<template-id>/config.ts
 */

import type { EditPattern } from '@report-templates/report-init-types';

// ============================================================================
// TYPES
// ============================================================================

export interface TemplateConfig {
  TEMPLATE_METADATA: {
    id: string; // Must match folder name in /report-templates/
    name: string;
    description: string;
    hasInitConfig: boolean;
  };
  INIT_TARGET_FILES: readonly string[];
  EDIT_PATTERNS: ReadonlyArray<EditPattern>;
  INITIAL_REPORT_STATE?: Record<string, unknown>;
  INITIAL_STATE?: Record<string, unknown>;
  REPORT_QUESTIONS?: readonly TemplateQuestion[];
}

export interface TemplateQuestion {
  id: string;
  key: string;
  question: string;
  label: string;
  type: string;
  topic?: string; // Optional topic grouping
  placeholder?: string;
  required?: boolean;
  category: 'required_fields' | 'sections' | 'other'; // Required
}

// ============================================================================
// CONFIG LOADING
// ============================================================================

/**
 * Load template config dynamically
 * Returns null if template doesn't exist or has no config
 */
export async function loadTemplateConfig(
  templateId: string | null | undefined
): Promise<TemplateConfig | null> {
  if (!templateId) return null;

  try {
    return (await import(
      `@report-templates/${templateId}/config`
    )) as TemplateConfig;
  } catch (error) {
    return null;
  }
}

// ============================================================================
// CONVENIENCE ACCESSORS
// ============================================================================

export async function getTemplateTargetFiles(
  templateId: string | null | undefined
): Promise<readonly string[]> {
  return (await loadTemplateConfig(templateId))?.INIT_TARGET_FILES || [];
}

export async function getTemplateEditPatterns(
  templateId: string | null | undefined
): Promise<ReadonlyArray<EditPattern>> {
  return (await loadTemplateConfig(templateId))?.EDIT_PATTERNS || [];
}

export async function getTemplateInitialState(
  templateId: string | null | undefined
): Promise<Record<string, unknown> | null> {
  const config = await loadTemplateConfig(templateId);
  return config?.INITIAL_REPORT_STATE || config?.INITIAL_STATE || null;
}

export async function getTemplateQuestions(
  templateId: string | null | undefined
): Promise<readonly TemplateQuestion[]> {
  return (await loadTemplateConfig(templateId))?.REPORT_QUESTIONS || [];
}
