/* eslint-disable @typescript-eslint/no-explicit-any */
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { getCurrentUser } from '@/lib/requests/user';
import { TablesInsert } from '@/database.types';
import { getContentTypeByFilename } from '@/lib/constants/file-types';
import { uploadFile } from '@/lib/storage/adapter';

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const draftId = url.searchParams.get('draft');
  if (!draftId) {
    return NextResponse.redirect(new URL('/', url.origin));
  }

  const user = await getCurrentUser();

  if (!user) {
    const loginUrl = new URL('/auth/login', url.origin);
    loginUrl.searchParams.set(
      'next',
      `/import?draft=${encodeURIComponent(draftId)}`
    );
    return NextResponse.redirect(loginUrl);
  }

  const supabase = (
    user.app_metadata?.provider === 'email'
      ? await createClient()
      : await createServiceClient()
  ) as any;

  // Fetch draft
  const { data: draft, error: draftError } = await (supabase
    .from('drafts' as any)
    .select('*')
    .eq('id', draftId)
    .single() as any);

  if (draftError || !draft) {
    return NextResponse.redirect(new URL('/', url.origin));
  }

  const title: string = (draft.title as string) || 'Imported from Tools';
  const content: string = draft.content as string;

  // Create project
  const projectData: TablesInsert<'projects'> = {
    title: title.slice(0, 120),
    user_id: user.id,
  };

  const { data: project, error: projectError } = await supabase
    .from('projects')
    .insert(projectData)
    .select()
    .single();

  if (projectError || !project) {
    return NextResponse.redirect(new URL('/', url.origin));
  }

  // Upload file content using storage adapter
  const mimeType = getContentTypeByFilename('main.tex');
  const blob = new Blob([content], { type: mimeType });

  const uploadResult = await uploadFile(supabase, project.id, 'main.tex', blob);

  if (uploadResult.error) {
    console.error('Error uploading file to storage:', uploadResult.error);
    return NextResponse.redirect(new URL('/', url.origin));
  }

  // Delete draft (best effort)
  await (supabase
    .from('drafts' as any)
    .delete()
    .eq('id', draftId) as any);

  return NextResponse.redirect(new URL(`/projects/${project.id}`, url.origin));
}
