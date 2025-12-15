import type { ProjectFile } from '@/hooks/use-file-editor';

/**
 * Extract subsection file options from the Subsections folder
 * Returns an array of {name, path} objects for files in the Subsections folder
 */
export function getSubsectionFiles(
  projectFiles: ProjectFile[]
): Array<{ name: string; path: string }> {
  const files = projectFiles.map((file) => {
    return { path: file.file.name, content: file.document?.content ?? '' };
  });

  // filter files that are in the subsections folder
  const subsectionFiles = files
    .filter((file) => {
      const path = file.path;
      return (
        path.startsWith('Subsections/') ||
        path.startsWith('subsections/') ||
        path.startsWith('Sections/') ||
        path.startsWith('sections/')
      );
    })
    .map((file) => {
      const path = file.path;
      const parts = path.split('/');
      const filename = parts[parts.length - 1];
      const nameWithoutExt = filename.replace(/\.(tex|md|txt)$/i, '');

      return {
        name: nameWithoutExt,
        path: path,
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));

  return subsectionFiles;
}
