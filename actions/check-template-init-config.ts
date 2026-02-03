'use server';

import { loadTemplateConfig } from '@/lib/template-config';

/**
 * Checks if a project's template has an init config for AI initialization.
 * Returns false if the template_id is null/undefined or if the template has no config.
 */
export async function checkTemplateHasInitConfig(
  templateId: string | null | undefined
): Promise<boolean> {
  const config = await loadTemplateConfig(templateId);
  return config !== null;
}
