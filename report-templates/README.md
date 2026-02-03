# Report Templates Directory

This directory contains all LaTeX report templates used by the application. Each template is a subdirectory containing:

- LaTeX files (main.tex, references.bib, etc.)
- **Optional**: `config.ts` for AI initialization features

## Structure

Templates are **auto-discovered** from `/report-templates/`. Each template directory can contain:

- LaTeX files (main.tex, etc.)
- **`config.ts`** (optional) - Enables "Initialize with AI" feature for projects created from this template

### Template Config Structure

```typescript
// /report-templates/my-template/config.ts
import type {
  EditPattern,
  ReportSection,
} from '@report-templates/report-init-types';

export const TEMPLATE_METADATA = {
  id: 'my-template', // MUST match the folder name
  name: 'My Template',
  description: 'Description',
  hasInitConfig: true,
};

export const INIT_TARGET_FILES = ['main.tex'];

export const EDIT_PATTERNS: readonly EditPattern[] = [
  // Define edit patterns here
];

export const INITIAL_STATE = {
  required_fields: {},
  sections: {},
  other: {},
  completed: false,
};

// Optional: UI questions for chat initialization
export const REPORT_QUESTIONS = [
  {
    key: 'field1', // Field key in required_fields or sections
    question: 'What is...?',
    topic: 'Field 1', // Short topic label for UI
    category: 'required_fields', // 'required_fields', 'sections', or 'other'
  },
] as const;
```

### Adding a New Template

1. **Create template directory**: `/report-templates/my-new-template/`
2. **Add LaTeX files**: `main.tex`, `references.bib`, etc.
3. **(Optional) Add config.ts** for AI initialization
   - Copy `config.example.ts` into the template's folder
     ```bash
     cp report-templates/config.example.ts report-templates/my-new-template/config.ts
     ```
   - Edit the config specific to your template
   - **Important**: `TEMPLATE_METADATA.id` must match the folder name
   - Import types from `@report-templates/report-init-types`

The template will be automatically discovered and:

- Appear in project creation UI
- Show "Initialize with AI" button if `config.ts` exists
- Load configuration dynamically at runtime

### How It Works

- **Discovery**: `/lib/templates.ts` scans `/report-templates/` directory
- **Config Detection**: Checks for `config.ts` in each template
- **Dynamic Loading**: Configs loaded via dynamic imports when needed
- **Shared Types**: Import from `@report-templates/report-init-types`
- **Path Alias**: Both main app and agent server use `@report-templates/*`
