/**
 * THESIS TEMPLATE - Initialization Config
 *
 * Example configuration for an academic thesis template.
 */

import type {
  EditPattern,
  SectionStatus,
  ReportSection,
} from '@report-templates/report-init-types';

// ============================================================================
// TEMPLATE METADATA
// ============================================================================

/**
 * Template metadata
 */
export const TEMPLATE_METADATA = {
  id: 'thesis-template',
  name: 'Academic Thesis',
  description: 'Academic thesis template with chapters and bibliography',
  hasInitConfig: true,
};

// ============================================================================
// TARGET FILES
// ============================================================================

export const INIT_TARGET_FILES = ['main.tex'];

// ============================================================================
// TYPES
// ============================================================================

export type { SectionStatus, ReportSection };

export interface RequiredFields extends Record<string, unknown> {
  thesis_title?: string;
  author_name?: string;
  submission_date?: string;
}

export interface ThesisInitializationState {
  required_fields: RequiredFields;
  sections: {
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

export const INITIAL_REPORT_STATE: ThesisInitializationState = {
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
// QUESTIONS
// ============================================================================

export const REPORT_QUESTIONS = [
  {
    key: 'thesis_title',
    question: 'What is the title of your thesis?',
    topic: 'Thesis Title',
    category: 'required_fields',
  },
  {
    key: 'author_name',
    question: 'What is your full name (as it should appear on the thesis)?',
    topic: 'Author Name',
    category: 'required_fields',
  },
  {
    key: 'submission_date',
    question: 'What is the submission date? (e.g., January 2024)',
    topic: 'Submission Date',
    category: 'required_fields',
  },
  {
    key: 'introduction',
    question: 'Provide an introduction for the thesis',
    topic: 'Introduction',
    category: 'sections',
  },
  // ...
] as const;

// ============================================================================
// FIELD DEFAULTS
// ============================================================================

export const FIELD_DEFAULTS = {
  thesis_title: 'Thesis Title',
  author_name: 'Author Name',
  submission_date: '\\today',
} as const;

// ============================================================================
// EDIT PATTERNS
// ============================================================================

export const EDIT_PATTERNS: EditPattern<RequiredFields>[] = [
  {
    name: 'thesis_title',
    type: 'single',
    startPattern: /\\title\{/,
    buildContent: (fields) =>
      `\\title{${fields.thesis_title || FIELD_DEFAULTS.thesis_title}}`,
    targetFile: 'main.tex',
  },
  {
    name: 'author_name',
    type: 'single',
    startPattern: /\\author\{/,
    buildContent: (fields) =>
      `\\author{${fields.author_name || FIELD_DEFAULTS.author_name}}`,
    targetFile: 'main.tex',
  },
  {
    name: 'submission_date',
    type: 'single',
    startPattern: /\\date\{/,
    buildContent: (fields) =>
      `\\date{${fields.submission_date || FIELD_DEFAULTS.submission_date}}`,
    targetFile: 'main.tex',
  },
];

// ============================================================================
// VALIDATION
// ============================================================================

import { validateReportConfig } from '@report-templates/report-init-types';

export const VALIDATED_CONFIG = validateReportConfig<
  RequiredFields,
  ThesisInitializationState['sections']
>({
  targetFiles: INIT_TARGET_FILES,
  initialState: INITIAL_REPORT_STATE,
  editPatterns: EDIT_PATTERNS,
});
