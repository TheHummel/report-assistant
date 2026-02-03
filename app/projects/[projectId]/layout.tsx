import type React from 'react';
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar';
import { AppSidebar } from '@/components/app-sidebar';
import { getCurrentUser } from '@/actions/get-user';

export default async function ProjectLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();
  const userName = user?.user_metadata?.name ?? user?.email ?? null;

  return (
    <SidebarProvider defaultOpen={true}>
      <AppSidebar userName={userName} />
      <SidebarInset className="flex h-screen flex-col overflow-hidden">
        {children}
      </SidebarInset>
    </SidebarProvider>
  );
}
