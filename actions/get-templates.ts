'use server';

import { getAvailableTemplates, type ProjectTemplate } from '@/lib/templates';

export async function getTemplates(): Promise<ProjectTemplate[]> {
  return getAvailableTemplates();
}
