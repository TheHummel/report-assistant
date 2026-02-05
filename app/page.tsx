import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/requests/user';
import { CreateProjectDialog } from '@/components/projects/create-project-dialog';
import { ProjectsTable } from '@/components/projects/projects-table';
import Navbar from '@/components/navbar';
import { getAllProjects } from '@/actions/get-projects';

export default async function Dashboard() {
  const user = await getCurrentUser();

  if (!user) {
    redirect('/auth/login');
  }

  const userName = user?.user_metadata?.name ?? user?.email ?? null;
  const data = await getAllProjects();

  return (
    <>
      <Navbar userName={userName} />

      <main className="container mx-auto px-4 py-8">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold text-neutral-900">Projects</h1>
            <p className="text-sm text-neutral-500">
              Manage and edit your projects
            </p>
          </div>

          <CreateProjectDialog />
        </div>

        <ProjectsTable data={data || []} />
      </main>
    </>
  );
}
