/**
 * TEMPLATE: Report Initialization Config
 *
 * Copy this file and customize it for your specific report type.
 * This template shows the structure and required exports.
 *
 * Steps to create a new report config:
 * 1. Add a new directory under report-templates/ for your template with the respective files.
 * 2. Copy this file to a new name (e.g., your-report-init-config.ts)
 * 3. Define TEMPLATE_METADATA with template info
 * 4. Define your RequiredFields interface
 * 5. Define your sections structure
 * 6. Set INIT_TARGET_FILES to the files you want to modify
 * 7. Define FIELD_DEFAULTS with placeholder values
 * 8. Define REPORT_QUESTIONS for the UI checklist
 * 9. Create template builder functions for complex structures
 * 10. Define EDIT_PATTERNS to specify what gets modified
 */

import type {
  EditPattern,
  SectionStatus,
  ReportSection,
} from './report-init-types';

// ============================================================================
// TEMPLATE METADATA
// ============================================================================

/**
 * Template metadata for project creation UI.
 * The 'id' must match your template folder name exactly.
 */
export const TEMPLATE_METADATA = {
  id: 'your-template-id', // MUST match folder name in report-templates/
  name: 'Your Template Name', // Display name in UI
  description: 'Brief description of this template', // Short description
  hasInitConfig: true,
};

// ============================================================================
// TARGET FILES
// ============================================================================

/** List of file paths to modify during initialization */
export const INIT_TARGET_FILES = [
  'path/to/your/file.tex',
  // ...
];

// ============================================================================
// REPORT-SPECIFIC TYPES
// ============================================================================

export type { SectionStatus, ReportSection };

/**
 * Define all fields your report needs
 * These will be filled in during the initialization process
 */
export interface RequiredFields extends Record<string, unknown> {
  // Example fields
  report_title?: string;
  report_author?: string;
  report_date?: string;
  // ...
}

/**
 * Define the complete state structure for the report
 */
export interface ReportInitializationState {
  required_fields: RequiredFields;
  sections: {
    // Define report sections
    introduction: ReportSection;
    methodology: ReportSection;
    results: ReportSection;
    conclusions: ReportSection;
  };
  other: {
    additional_notes?: string;
  };
  completed: boolean;
  last_updated?: Date;
}

// ============================================================================
// INITIAL STATE
// ============================================================================

export const INITIAL_REPORT_STATE: ReportInitializationState = {
  required_fields: {},
  sections: {
    introduction: { status: 'missing' },
    methodology: { status: 'missing' },
    results: { status: 'missing' },
    conclusions: { status: 'missing' },
  },
  other: {},
  completed: false,
};

// ============================================================================
// QUESTIONS (for UI checklist)
// ============================================================================

export const REPORT_QUESTIONS = [
  {
    key: 'report_title', // Field key in required_fields or sections
    question: 'What is the title of the report?',
    topic: 'Report Title', // Short topic label for UI
    category: 'required_fields', // 'required_fields', 'sections', or 'other'
  },
  {
    key: 'report_author',
    question: 'Who is the author of this report?',
    topic: 'Author',
    category: 'required_fields',
  },
  {
    key: 'report_date',
    question: 'What is the date of this report?',
    topic: 'Date',
    category: 'required_fields',
  },
  {
    key: 'introduction',
    question: 'Provide an introduction for the report',
    topic: 'Introduction',
    category: 'sections',
  },
  // ...
] as const;

// ============================================================================
// FIELD DEFAULTS (placeholders for templates)
// ============================================================================

/**
 * Default placeholder values used when a field is not provided
 */
export const FIELD_DEFAULTS = {
  report_title: '*Report Title*',
  report_author: 'Author Name',
  report_date: 'YYYY-MM-DD',
  // ...
} as const;

// ============================================================================
// TEMPLATE BUILDERS (optional)
// ============================================================================

/**
 * Helper function to build complex LaTeX structures
 * Only needed if you have multi-line blocks to generate
 */
function buildReportHeaderTemplate(fields: RequiredFields): string {
  return `\\title{${fields.report_title || FIELD_DEFAULTS.report_title}}
\\author{${fields.report_author || FIELD_DEFAULTS.report_author}}
\\date{${fields.report_date || FIELD_DEFAULTS.report_date}}`;
}

// ============================================================================
// EDIT PATTERNS
// ============================================================================

/**
 * Define all the modifications to be made to target files
 * Each pattern specifies:
 * - what to search for (startPattern)
 * - how to generate the new content (buildContent)
 * - optional: condition for when to apply (condition)
 */
export const EDIT_PATTERNS: EditPattern<RequiredFields>[] = [
  // Example 1: Single-line replacement
  {
    name: 'report_title',
    type: 'single',
    startPattern: /\\title\{/,
    buildContent: (fields) =>
      `\\title{${fields.report_title || FIELD_DEFAULTS.report_title}}`,
    condition: (fields) => !!fields.report_title,
    targetFile: 'path/to/your/file.tex', // REQUIRED: must match INIT_TARGET_FILES exactly
  },

  // Example 2: Block replacement (replaces everything between start and end patterns)
  {
    name: 'header_block',
    type: 'block',
    startPattern: /\\begin\{header\}/,
    endPattern: /\\end\{header\}/,
    buildContent: buildReportHeaderTemplate,
    targetFile: 'path/to/your/file.tex', // REQUIRED
  },

  // Example 3: Conditional replacement (boolean toggle)
  {
    name: 'include_appendix',
    type: 'single',
    startPattern: /\\includeAppendix\{/,
    buildContent: (fields) => {
      // Custom logic to determine value
      const includeIt = fields.report_title?.includes('detailed');
      return `\\includeAppendix{${includeIt}}`;
    },
    targetFile: 'path/to/your/file.tex', // REQUIRED
  },

  // ...
];

// ============================================================================
// VALIDATION (RECOMMENDED)
// ============================================================================

/**
 * Validates that this config satisfies the ReportInitConfig contract.
 * Compile-time type safety for report initialization configs.
 */
import { validateReportConfig } from './report-init-types';

export const VALIDATED_CONFIG = validateReportConfig<
  RequiredFields,
  ReportInitializationState['sections']
>({
  targetFiles: INIT_TARGET_FILES,
  initialState: INITIAL_REPORT_STATE,
  editPatterns: EDIT_PATTERNS,
});
