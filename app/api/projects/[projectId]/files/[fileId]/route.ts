import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import {
  getContentTypeByFilename,
  isBinaryFile,
} from '@/lib/constants/file-types';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string; fileId: string }> }
) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { projectId, fileId } = await params;

    const { data: storageFiles, error: listError } = await supabase.storage
      .from('lars')
      .list(`projects/${projectId}`);

    if (listError || !storageFiles) {
      return NextResponse.json(
        { error: 'Failed to list files' },
        { status: 500 }
      );
    }

    const file = storageFiles.find((f) => f.id === fileId);

    if (!file) {
      return NextResponse.json({ error: 'File not found' }, { status: 404 });
    }

    const { data: fileBlob, error: downloadError } = await supabase.storage
      .from('lars')
      .download(`projects/${projectId}/${file.name}`);

    if (downloadError || !fileBlob) {
      return NextResponse.json(
        { error: 'Failed to download file' },
        { status: 500 }
      );
    }

    let content: string;
    if (isBinaryFile(file.name)) {
      const arrayBuffer = await fileBlob.arrayBuffer();
      const uint8Array = new Uint8Array(arrayBuffer);
      content = btoa(String.fromCharCode(...uint8Array));
    } else {
      content = await fileBlob.text();
    }

    return NextResponse.json({
      file: {
        id: file.id,
        name: file.name,
        project_id: projectId,
        size: file.metadata?.size || null,
        type: file.metadata?.mimetype || null,
        uploaded_at: file.created_at,
      },
      document: {
        id: file.id,
        title: file.name,
        content: content,
        owner_id: user.id,
        project_id: projectId,
        filename: file.name,
        document_type: file.name === 'main.tex' ? 'article' : 'file',
        created_at: file.created_at,
        updated_at: file.updated_at || file.created_at,
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
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { projectId, fileId } = await params;
    const { content, filename } = await request.json();

    if (content === undefined || content === null) {
      return NextResponse.json(
        { error: 'Content is required' },
        { status: 400 }
      );
    }

    // use filename if provided, otherwise fall back to fileId lookup
    let targetFilename = filename;

    if (!targetFilename) {
      // try to find file by ID
      const { data: storageFiles, error: listError } = await supabase.storage
        .from('lars')
        .list(`projects/${projectId}`);

      if (listError || !storageFiles) {
        return NextResponse.json(
          { error: 'Failed to list files' },
          { status: 500 }
        );
      }

      const file = storageFiles.find((f) => f.id === fileId);

      if (!file) {
        return NextResponse.json({ error: 'File not found' }, { status: 404 });
      }

      targetFilename = file.name;
    }

    const contentType = getContentTypeByFilename(targetFilename);
    let blob: Blob;

    if (isBinaryFile(targetFilename)) {
      const binaryString = atob(content);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      blob = new Blob([bytes], { type: contentType });
    } else {
      blob = new Blob([content], { type: contentType });
    }

    const { error: uploadError } = await supabase.storage
      .from('lars')
      .upload(`projects/${projectId}/${targetFilename}`, blob, {
        cacheControl: '3600',
        upsert: true,
        contentType,
      });

    if (uploadError) {
      console.error('Upload error:', uploadError);
      return NextResponse.json(
        { error: 'Failed to save file' },
        { status: 500 }
      );
    }

    revalidatePath(`/projects/${projectId}`);

    // handle nested paths in filename
    const lastSlashIndex = targetFilename.lastIndexOf('/');
    const dirPath =
      lastSlashIndex > 0 ? targetFilename.substring(0, lastSlashIndex) : '';
    const fileName =
      lastSlashIndex > 0
        ? targetFilename.substring(lastSlashIndex + 1)
        : targetFilename;

    // get updated file metadata after save
    const listPath = dirPath
      ? `projects/${projectId}/${dirPath}`
      : `projects/${projectId}`;

    const { data: updatedFiles, error: listAfterError } = await supabase.storage
      .from('lars')
      .list(listPath);

    const updatedFile = updatedFiles?.find((f) => f.name === fileName);

    return NextResponse.json({
      file: {
        id: updatedFile?.id || fileId,
        name: targetFilename,
        project_id: projectId,
        size: updatedFile?.metadata?.size || null,
        type: updatedFile?.metadata?.mimetype || null,
        uploaded_at: updatedFile?.created_at || new Date().toISOString(),
      },
      document: {
        id: updatedFile?.id || fileId,
        title: targetFilename,
        content: content,
        owner_id: user.id,
        project_id: projectId,
        filename: targetFilename,
        document_type: targetFilename === 'main.tex' ? 'article' : 'file',
        created_at: updatedFile?.created_at || new Date().toISOString(),
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
