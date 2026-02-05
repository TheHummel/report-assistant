import { createClient, createServiceClient } from '@/lib/supabase/server';
import { getCurrentUser } from '@/lib/requests/user';
import { NextRequest, NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import {
  getContentTypeByFilename,
  isBinaryFile,
} from '@/lib/constants/file-types';
import { downloadFile, updateFile } from '@/lib/storage/adapter';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string; fileId: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = (
      user.app_metadata?.provider === 'email'
        ? await createClient()
        : await createServiceClient()
    ) as any;

    const { projectId, fileId } = await params;

    // Get file metadata from database
    const { data: fileRecord, error: fileError } = await supabase
      .from('files')
      .select('*')
      .eq('id', fileId)
      .eq('project_id', projectId)
      .single();

    if (fileError || !fileRecord) {
      return NextResponse.json({ error: 'File not found' }, { status: 404 });
    }

    // Download file content using storage adapter
    const { data: content, error: downloadError } = await downloadFile(
      supabase,
      projectId,
      fileRecord.name
    );

    if (downloadError || !content) {
      return NextResponse.json(
        { error: 'Failed to download file' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      file: {
        id: fileRecord.id,
        name: fileRecord.name,
        project_id: projectId,
        size: fileRecord.size,
        type: fileRecord.type,
        uploaded_at: fileRecord.uploaded_at,
      },
      document: {
        id: fileRecord.id,
        title: fileRecord.name,
        content: content,
        owner_id: user.id,
        project_id: projectId,
        filename: fileRecord.name,
        document_type: fileRecord.name === 'main.tex' ? 'article' : 'file',
        created_at: fileRecord.uploaded_at,
        updated_at: fileRecord.uploaded_at,
      },
    });
  } catch (error) {
    console.error('Error fetching file:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string; fileId: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = (
      user.app_metadata?.provider === 'email'
        ? await createClient()
        : await createServiceClient()
    ) as any;

    const { projectId, fileId } = await params;
    const { content, filename } = await request.json();

    if (content === undefined || content === null) {
      return NextResponse.json(
        { error: 'Content is required' },
        { status: 400 }
      );
    }

    // Use filename if provided, otherwise look up by fileId
    let targetFilename = filename;

    if (!targetFilename) {
      // Get file metadata from database
      const { data: fileRecord, error: fileError } = await supabase
        .from('files')
        .select('name')
        .eq('id', fileId)
        .eq('project_id', projectId)
        .single();

      if (fileError || !fileRecord) {
        return NextResponse.json({ error: 'File not found' }, { status: 404 });
      }

      targetFilename = fileRecord.name;
    }

    const contentType = getContentTypeByFilename(targetFilename);
    const isBinary = isBinaryFile(targetFilename);

    // Update file using storage adapter
    const { error: updateError } = await updateFile(
      supabase,
      projectId,
      targetFilename,
      content,
      contentType,
      isBinary
    );

    if (updateError) {
      console.error('Upload error:', updateError);
      return NextResponse.json(
        { error: 'Failed to save file' },
        { status: 500 }
      );
    }

    revalidatePath(`/projects/${projectId}`);

    // Get updated file metadata
    const { data: updatedFile, error: fetchError } = await supabase
      .from('files')
      .select('*')
      .eq('project_id', projectId)
      .eq('name', targetFilename)
      .single();

    const fileData = updatedFile || {
      id: fileId,
      name: targetFilename,
      size: isBinary ? Buffer.from(content, 'base64').length : content.length,
      type: contentType,
      uploaded_at: new Date().toISOString(),
    };

    return NextResponse.json({
      file: {
        id: fileData.id,
        name: fileData.name,
        project_id: projectId,
        size: fileData.size,
        type: fileData.type,
        uploaded_at: fileData.uploaded_at,
      },
      document: {
        id: fileData.id,
        title: fileData.name,
        content: content,
        owner_id: user.id,
        project_id: projectId,
        filename: fileData.name,
        document_type: fileData.name === 'main.tex' ? 'article' : 'file',
        created_at: fileData.uploaded_at,
        updated_at: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error('Error saving file:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
