/**
 * Template Registry
 *
 * Auto-discovers templates from /report-templates/ directory.
 * Each template can optionally have a config.ts file for assisted initialization.
 *
 */

import fs from 'fs';
import path from 'path';

// ============================================================================
// TYPES
// ============================================================================

export interface ProjectTemplate {
  /** Unique identifier - must match folder name in /report-templates/ */
  id: string;
  /** Display name shown in UI */
  name: string;
  /** Short description */
  description: string;
  /** Whether this template has a config.ts file */
  hasInitConfig: boolean;
}

// ============================================================================
// TEMPLATE DISCOVERY
// ============================================================================

/**
 * Auto-discover all templates from /report-templates/ directory
 */
async function discoverTemplates(): Promise<ProjectTemplate[]> {
  const templatesDir = path.join(process.cwd(), 'report-templates');

  if (!fs.existsSync(templatesDir)) {
    console.warn('Templates directory not found:', templatesDir);
    return [];
  }

  const entries = fs.readdirSync(templatesDir, { withFileTypes: true });
  const templates: ProjectTemplate[] = [];

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;

    const templateId = entry.name;

    // Try loading config metadata
    try {
      const configPath = path.join(templatesDir, templateId, 'config.ts');
      if (fs.existsSync(configPath)) {
        const config = await import(`@report-templates/${templateId}/config`);
        templates.push({
          ...config.TEMPLATE_METADATA,
          hasInitConfig: true,
        });
        continue;
      }
    } catch (error) {
      console.error(`Failed to load metadata for ${templateId}:`, error);
    }

    // Fallback: no config, generate defaults
    templates.push({
      id: templateId,
      name: formatTemplateName(templateId),
      description: `Template: ${templateId}`,
      hasInitConfig: false,
    });
  }

  return templates;
}

/**
 * Convert template ID to display name
 * e.g., "radiation-test-report-template-master" → "Radiation Test Report Template Master"
 */
function formatTemplateName(id: string): string {
  return id
    .split('-')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

/**
 * Available project templates.
 * Templates are auto-discovered from /report-templates/ directory.
 */
let _templatesCache: ProjectTemplate[] | null = null;

async function getTemplates(): Promise<ProjectTemplate[]> {
  if (!_templatesCache) {
    _templatesCache = await discoverTemplates();
  }
  return _templatesCache;
}

export const PROJECT_TEMPLATES: Promise<ProjectTemplate[]> = getTemplates();

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Get all available templates
 */
export async function getAvailableTemplates(): Promise<ProjectTemplate[]> {
  const templates = await getTemplates();
  return templates.filter((template) => {
    const templateDir = path.join(
      process.cwd(),
      'report-templates',
      template.id
    );
    return fs.existsSync(templateDir);
  });
}

/**
 * Get a specific template by ID
 */
export async function getTemplateById(
  id: string
): Promise<ProjectTemplate | undefined> {
  const templates = await getTemplates();
  return templates.find((t) => t.id === id);
}

/**
 * Get the full path to a template directory
 */
export async function getTemplatePath(
  templateId: string
): Promise<string | null> {
  const template = await getTemplateById(templateId);
  if (!template) return null;
  return path.join(process.cwd(), 'report-templates', template.id);
}

/**
 * Read all files from a template directory recursively
 */
export async function getTemplateFiles(
  templateId: string
): Promise<TemplateFile[]> {
  const templatePath = await getTemplatePath(templateId);
  if (!templatePath || !fs.existsSync(templatePath)) {
    return [];
  }

  const files: TemplateFile[] = [];
  await readDirectoryRecursive(templatePath, '', files);
  return files;
}

export interface TemplateFile {
  /** Relative path from template root */
  path: string;
  /** File content (base64 for binary files) */
  content: string;
  /** MIME type */
  contentType: string;
  /** Whether content is base64 encoded */
  isBinary: boolean;
}

const BINARY_EXTENSIONS = [
  '.png',
  '.jpg',
  '.jpeg',
  '.gif',
  '.pdf',
  '.eps',
  '.svg',
];
const TEXT_EXTENSIONS = ['.tex', '.bib', '.cls', '.sty', '.txt', '.md'];

async function readDirectoryRecursive(
  basePath: string,
  relativePath: string,
  files: TemplateFile[]
): Promise<void> {
  const currentPath = path.join(basePath, relativePath);
  const entries = fs.readdirSync(currentPath, { withFileTypes: true });

  for (const entry of entries) {
    const entryRelativePath = relativePath
      ? `${relativePath}/${entry.name}`
      : entry.name;

    if (entry.isDirectory()) {
      await readDirectoryRecursive(basePath, entryRelativePath, files);
    } else if (entry.isFile()) {
      const ext = path.extname(entry.name).toLowerCase();
      const isBinary = BINARY_EXTENSIONS.includes(ext);
      const isText = TEXT_EXTENSIONS.includes(ext);

      // Skip unknown file types
      if (!isBinary && !isText) continue;

      const fullPath = path.join(basePath, entryRelativePath);
      const content = isBinary
        ? fs.readFileSync(fullPath).toString('base64')
        : fs.readFileSync(fullPath, 'utf-8');

      const contentType = getContentType(ext);

      files.push({
        path: entryRelativePath,
        content,
        contentType,
        isBinary,
      });
    }
  }
}

function getContentType(ext: string): string {
  const types: Record<string, string> = {
    '.tex': 'application/x-tex',
    '.bib': 'application/x-bibtex',
    '.cls': 'application/x-tex',
    '.sty': 'application/x-tex',
    '.txt': 'text/plain',
    '.md': 'text/markdown',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.pdf': 'application/pdf',
    '.eps': 'application/postscript',
    '.svg': 'image/svg+xml',
  };
  return types[ext] || 'application/octet-stream';
}

// ============================================================================
// DEFAULT EMPTY PROJECT CONTENT
// ============================================================================

export const EMPTY_PROJECT_CONTENT = `\\documentclass{article}
\\usepackage[utf8]{inputenc}
\\usepackage{amsmath}
\\usepackage{graphicx}

\\title{Untitled Document}
\\author{Author Name}
\\date{\\today}

\\begin{document}

\\maketitle

\\section{Introduction}
Start writing your document here.

\\end{document}
`;

export const EMPTY_PROJECT_FILE = {
  name: 'main.tex',
  content: EMPTY_PROJECT_CONTENT,
  contentType: 'application/x-tex',
};
