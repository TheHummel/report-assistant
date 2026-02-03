'use client';

import { createProject } from '../actions/create-project';
import { useProjectRefresh } from '@/app/context/project';

export function useCreateProject() {
  const { refreshProjects } = useProjectRefresh();

  const createProjectWithRefresh = async (
    title: string,
    templateId?: string | null
  ) => {
    const result = await createProject(title, templateId);

    if (result.success) {
      refreshProjects();
    }

    return result;
  };

  return { createProjectWithRefresh };
}
