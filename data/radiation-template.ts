// Radiation Test Report Template

import fs from 'fs';
import path from 'path';

export interface TemplateFile {
  path: string;
  content: string;
  contentType: string;
  isBinary?: boolean;
}

// content type mapping based on file extension
function getContentType(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  switch (ext) {
    case '.tex':
      return 'text/x-tex';
    case '.cls':
      return 'text/x-tex';
    case '.bib':
      return 'text/x-bibtex';
    case '.png':
      return 'image/png';
    case '.jpg':
    case '.jpeg':
      return 'image/jpeg';
    default:
      return 'text/plain';
  }
}

// read template files from public directory
export async function getRadiationTemplateFiles(
  baseDir: string,
  relativePath: string = ''
): Promise<TemplateFile[]> {
  const files: TemplateFile[] = [];
  const currentDir = path.join(baseDir, relativePath);

  const entries = fs.readdirSync(currentDir, { withFileTypes: true });

  for (const entry of entries) {
    const entryRelativePath = relativePath
      ? `${relativePath}/${entry.name}`
      : entry.name;

    if (entry.isDirectory()) {
      if (entry.name.startsWith('.')) continue;

      const subFiles = await getRadiationTemplateFiles(
        baseDir,
        entryRelativePath
      );
      files.push(...subFiles);
    } else if (entry.isFile()) {
      if (entry.name.startsWith('.') || entry.name === 'README.md') continue;

      const filePath = path.join(currentDir, entry.name);
      const contentType = getContentType(entry.name);

      // read binary files as Buffer, text files as string
      const isBinary = contentType.startsWith('image/');
      const content = isBinary
        ? fs.readFileSync(filePath).toString('base64')
        : fs.readFileSync(filePath, 'utf-8');

      files.push({
        path: entryRelativePath,
        content,
        contentType,
        isBinary,
      });
    }
  }

  return files;
}

// main file (entry point)
export const RADIATION_TEMPLATE_MAIN_FILE = 'Report.tex';
