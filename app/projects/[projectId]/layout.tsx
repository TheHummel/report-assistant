import type React from 'react';
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from '@/components/ui/sidebar';
import { AppSidebar } from '@/components/app-sidebar';
import { ProjectBreadcrumbs } from '@/components/projects/project-breadcrumbs';
import { getProjectById } from '@/actions/get-projects';
import { getCurrentUser } from '@/actions/get-user';
import { House } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default async function ProjectLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  const user = await getCurrentUser();
  const userName = user?.user_metadata?.name ?? user?.email ?? null;
  const project = await getProjectById(projectId);

  return (
    <SidebarProvider defaultOpen={true}>
      <AppSidebar userName={userName} />
      <SidebarInset className="flex h-screen flex-col overflow-hidden">
        <header className="relative flex flex-shrink-0 items-center justify-between border-b px-4 py-3">
          <div className="absolute left-2 flex items-center gap-2">
            <SidebarTrigger />
          </div>

          <div className="flex w-full min-w-0 items-center justify-center px-[135px]">
            <ProjectBreadcrumbs projectTitle={project?.title || 'Project'} />
          </div>

          <div className="absolute right-4 flex items-center gap-2">
            <Button
              data-sidebar="trigger"
              data-slot="sidebar-trigger"
              variant="ghost"
              size="sm"
            >
              <House />
            </Button>
          </div>
        </header>

        <div className="min-h-0 flex-1 overflow-hidden">{children}</div>
      </SidebarInset>
    </SidebarProvider>
  );
}
