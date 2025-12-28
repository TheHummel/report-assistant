import type { CompilationError } from '@/types/compilation';
import { isBinaryFile } from '@/lib/constants/file-types';

export function normalizePath(name: string): string {
  if (!name) return 'document.tex';
  return name.includes('.') ? name : `${name}.tex`;
}

export function summarizeLog(log?: string): string | undefined {
  if (!log) return undefined;
  const lines = log.split('\n').filter((line) => line.trim().length > 0);
  const lastLines = lines.slice(-5);
  return lastLines.join('\n');
}

export function createCompilationError(
  data: any,
  errorMessage: string
): CompilationError {
  return {
    message: errorMessage,
    details: data?.details,
    log: data?.log,
    stdout: data?.stdout,
    stderr: data?.stderr,
    code: data?.code,
    requestId: data?.requestId,
    queueMs: data?.queueMs,
    durationMs: data?.durationMs,
    summary: summarizeLog(data?.log || data?.stderr || data?.stdout),
    pdf: data?.pdf, // Include partial PDF if available despite error
  };
}

export async function processFileContent(
  fileBlob: Blob,
  fileName: string
): Promise<{ path: string; content: string; encoding?: string }> {
  const isBinary = isBinaryFile(fileName);
  let content: string;

  if (isBinary) {
    const arrayBuffer = await fileBlob.arrayBuffer();
    const uint8Array = new Uint8Array(arrayBuffer);
    // Convert to base64 in chunks to avoid stack overflow with large files
    let binary = '';
    const chunkSize = 32768;
    for (let i = 0; i < uint8Array.length; i += chunkSize) {
      const chunk = uint8Array.subarray(i, i + chunkSize);
      binary += String.fromCharCode.apply(null, chunk as unknown as number[]);
    }
    content = btoa(binary);
  } else {
    content = await fileBlob.text();
  }

  const fileEntry: {
    path: string;
    content: string;
    encoding?: string;
  } = {
    path: fileName,
    content: content,
  };

  if (isBinary) {
    fileEntry.encoding = 'base64';
  }

  return fileEntry;
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  const chunkSize = 32768;

  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode.apply(null, chunk as unknown as number[]);
  }

  return btoa(binary);
}

export async function makeCompilationRequest(
  filesPayload: Array<{ path: string; content: string; encoding?: string }>,
  normalizedFileName: string,
  projectId?: string
): Promise<{ response: Response; data: any }> {
  const requestBody = {
    files: filesPayload,
    projectId,
    lastModifiedFile: normalizedFileName,
  };

  const response = await fetch('/api/compile-pdf', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(requestBody),
  });
  const contentType = response.headers.get('content-type')?.toLowerCase() || '';
  let data: any;

  try {
    if (contentType.includes('application/json')) {
      data = await response.json();
    } else if (contentType.includes('application/pdf')) {
      const buffer = await response.arrayBuffer();
      data = { pdf: arrayBufferToBase64(buffer) };
    } else {
      const raw = await response.text();
      try {
        data = JSON.parse(raw);
      } catch {
        data = { raw };
      }
    }
  } catch (parseError) {
    data = { error: 'Failed to read compilation response', details: String(parseError) };
  }

  return { response, data };
}
