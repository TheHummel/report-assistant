'use client';

import { SidebarTrigger } from '@/components/ui/sidebar';
import { ProjectBreadcrumbs } from '@/components/projects/project-breadcrumbs';

interface ProjectHeaderProps {
  projectTitle: string;
}

export function ProjectHeader({ projectTitle }: ProjectHeaderProps) {
  return (
    <header className="relative flex h-[48px] flex-shrink-0 items-center justify-between border-b px-4">
      <div className="absolute left-2 flex items-center gap-2">
        <SidebarTrigger />
      </div>

      <div className="flex w-full min-w-0 items-center justify-center px-[135px]">
        <ProjectBreadcrumbs projectTitle={projectTitle} />
      </div>
    </header>
  );
}
