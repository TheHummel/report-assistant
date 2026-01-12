/**
 * Generic types and interfaces for report initialization system
 *
 * Defines the CONTRACT that any report config must follow.
 * Report-specific implementations should import and use these types.
 */

// ============================================================================
// GENERIC SECTION TYPES
// ============================================================================

export type SectionStatus = 'missing' | 'partial' | 'complete';

export interface ReportSection {
  status: SectionStatus;
  content?: string;
}

// ============================================================================
// EDIT PATTERN CONTRACT
// ============================================================================

export interface EditPattern<TFields = Record<string, unknown>> {
  name: string;
  // Single-line or block edit
  type: 'single' | 'block';
  // Pattern to find the line/block
  startPattern: RegExp;
  // For blocks: pattern to find the end
  endPattern?: RegExp;
  // Function to build the new content
  buildContent: (fields: TFields) => string;
  // Condition to check if this edit should be applied
  condition?: (fields: TFields) => boolean;
  // Target file: specifies which file from INIT_TARGET_FILES this pattern applies to
  // Use full path as defined in INIT_TARGET_FILES (e.g., 'Inputs/inputs.tex')
  targetFile: string;
}

// ============================================================================
// REPORT CONFIG CONTRACT
// ============================================================================

export interface ReportInitConfig<
  TFields extends Record<string, unknown>,
  TSections extends Record<string, ReportSection>,
> {
  // Files to target the edits to
  targetFiles: readonly string[];

  // Initial state
  initialState: {
    required_fields: Partial<TFields>;
    sections: TSections;
    other: Record<string, unknown>;
    completed: boolean;
    last_updated?: Date;
  };

  // Edit patterns
  editPatterns: ReadonlyArray<EditPattern<TFields>>;
}

// ============================================================================
// VALIDATION HELPER
// ============================================================================

/**
 * Helper to validate that a config satisfies the ReportInitConfig contract
 * Use in the config file to ensure type safety at compile time
 */
export function validateReportConfig<
  TFields extends Record<string, unknown>,
  TSections extends Record<string, ReportSection>,
>(
  config: ReportInitConfig<TFields, TSections>
): ReportInitConfig<TFields, TSections> {
  return config;
}
