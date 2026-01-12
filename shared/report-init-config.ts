/**
 * RADIATION TEST REPORT - Initialization Config
 *
 * Report-specific configuration for CERN radiation test reports.
 *
 */

import type { EditPattern, ReportSection } from './report-init-types';
import { validateReportConfig } from './report-init-types';

// ============================================================================
// TARGET FILES: list of paths to modify during init process
// ============================================================================

export const INIT_TARGET_FILES = ['Inputs/inputs.tex'];

// ============================================================================
// REPORT-SPECIFIC TYPES
// ============================================================================

/**
 * Fields required for CERN radiation test reports
 */
export interface RequiredFields extends Record<string, unknown> {
  // Facility
  test_facility?: string;
  test_date?: string;

  // Responsibility Data
  concerned_equipment?: string;
  group?: string;
  report_author?: string;
  specifications_responsibles?: string;
  test_team?: string;
  schematic_responsible?: string;
  software_responsible?: string;
  pcb_responsible?: string;
  device_type?: string;
  device_type_short?: string;

  // DUT Identification
  devices_under_test?: string;
  dut_name_short?: string;
  dut_types?: string;
  dut_manufacturer?: string;
  dut_package?: string;
  dut_samples?: string;
  dut_test_type?: string;
  dut_date_code?: string;
  dut_lot_code?: string;

  // Other
  edms_number?: string;
  irradiation_conditions?: string;
}

/**
 * Initialiazation state structure for CERN radiation test reports
 */
export interface ReportInitializationState {
  required_fields: RequiredFields;
  sections: {
    overview: ReportSection;
    dut_identification: ReportSection;
    test_board_setup: ReportSection;
    test_procedure: ReportSection;
    irradiation_conditions: ReportSection;
    experimental_results: ReportSection;
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
    overview: { status: 'missing' },
    dut_identification: { status: 'missing' },
    test_board_setup: { status: 'missing' },
    test_procedure: { status: 'missing' },
    irradiation_conditions: { status: 'missing' },
    experimental_results: { status: 'missing' },
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
    key: 'test_facility',
    question: 'Which test facility was used? (PSI, Cobalt-60, or CHARM)',
    topic: 'Test Facility',
    category: 'required_fields',
  },
  {
    key: 'test_date',
    question:
      'What were the test campaign dates? (e.g., 01.03.2024 - 15.03.2024)',
    topic: 'Test Dates',
    category: 'required_fields',
  },
  {
    key: 'concerned_equipment',
    question: 'What is the concerned equipment/system?',
    topic: 'Concerned Equipment',
    category: 'required_fields',
  },
  {
    key: 'group',
    question: 'Which group/department is responsible?',
    topic: 'Responsible Group',
    category: 'required_fields',
  },
  {
    key: 'report_author',
    question:
      'Who are the report authors? (separate multiple names with commas)',
    topic: 'Report Authors',
    category: 'required_fields',
  },
  {
    key: 'device_type',
    question: 'What is the device type?',
    topic: 'Device Type',
    category: 'required_fields',
  },
  {
    key: 'devices_under_test',
    question: 'What is the Device Under Test (DUT) reference/name?',
    topic: 'Device Under Test (DUT)',
    category: 'required_fields',
  },
  {
    key: 'dut_types',
    question: 'What is the DUT type/model?',
    topic: 'DUT Type/Model',
    category: 'required_fields',
  },
  {
    key: 'dut_manufacturer',
    question: 'Who is the DUT manufacturer?',
    topic: 'DUT Manufacturer',
    category: 'required_fields',
  },
  {
    key: 'dut_package',
    question: 'What is the DUT package type?',
    topic: 'DUT Package',
    category: 'required_fields',
  },
  {
    key: 'overview',
    question:
      'Can you provide a brief overview of the test purpose and objectives?',
    topic: 'Purpose and Objectives',
    category: 'sections',
  },
  {
    key: 'test_procedure',
    question: 'What is the test procedure that will be followed?',
    topic: 'Test Procedure',
    category: 'sections',
  },
  {
    key: 'irradiation_conditions',
    question: 'What are the irradiation conditions for this test?',
    topic: 'Irradiation Conditions',
    category: 'sections',
  },
  {
    key: 'additional_notes',
    question: 'Are there any additional notes or special considerations?',
    topic: 'Additional Notes',
    category: 'other',
  },
];

// ============================================================================
// FIELD DEFAULTS (LaTeX placeholders for backend)
// ============================================================================

export const FIELD_DEFAULTS = {
  concerned_equipment: '*Concerned Equipment*',
  group: '*Group*',
  test_date: 'xx.xx.202x - xx.xx.202x',
  specifications_responsibles: 'Name Surname',
  test_team: 'Name Surname \\\\Name Surname \\\\ Name Surname',
  schematic_responsible: 'Name Surname',
  software_responsible: '-',
  pcb_responsible: 'Name Surname',
  report_author: 'Name Surname \\\\ Name Surname',
  device_type: '*Device Type*',
  device_type_short: '*Device Type*',
  devices_under_test: '*DUT Name*',
  dut_name_short: '*DUT Name Short*',
  dut_types: '*DUT Type',
  dut_samples: 'xxx',
  dut_test_type: '\\textbf{TID/DD:} \\textDelta Icc, \\textbf{SEE:} SEL',
  dut_package: '*Package*',
  dut_manufacturer: '*Manufacturer*',
  dut_date_code: 'xxx',
  dut_lot_code: '',
} as const;

// ============================================================================
// FACILITIES CONFIG
// ============================================================================

export const FACILITIES = [
  { key: 'PSI', boolName: 'PSIReport', keywords: ['psi'] },
  { key: 'Cobalt', boolName: 'CobaltReport', keywords: ['cobalt', 'cc60'] },
  { key: 'CHARM', boolName: 'CHARMReport', keywords: ['charm'] },
] as const;

// ============================================================================
// TEMPLATE BUILDERS (LaTeX structure)
// ============================================================================

/**
 * Build ResponsibilityData block content
 */
export function buildResponsibilityDataTemplate(
  fields: RequiredFields
): string {
  const capitalize = (str: string) =>
    str.replace(/\b\w/g, (l) => l.toUpperCase());

  const formatAuthors = (input: string) =>
    input
      .split(',')
      .map((name) => name.trim())
      .filter((name) => name.length > 0)
      .map(capitalize)
      .join(' \\\\ ');

  const f = fields;
  const d = FIELD_DEFAULTS;

  return `\\ResponsibilityData{
ConcernedEquipment                  =   {${f.concerned_equipment || d.concerned_equipment}},
Group                               =   {${f.group || d.group}},
CampaignDate                        =   {${f.test_date || d.test_date}},
SpecificationsResponsibles          =   {${f.specifications_responsibles ? capitalize(f.specifications_responsibles) : d.specifications_responsibles}},
TestTeam                            =   {${f.test_team ? formatAuthors(f.test_team) : d.test_team}},
SchematicResponsible                =   {${f.schematic_responsible ? capitalize(f.schematic_responsible) : d.schematic_responsible}},
SoftwareResponsible                 =   {${f.software_responsible || d.software_responsible}}, 
PCBResponsible                      =   {${f.pcb_responsible ? capitalize(f.pcb_responsible) : d.pcb_responsible}},
ReportAuthors                       =   {${f.report_author ? formatAuthors(f.report_author) : d.report_author}},
DeviceType                          =   {${f.device_type || d.device_type}},
DeviceTypeShort                     =   {${f.device_type_short || d.device_type_short}} 
}`;
}

/**
 * Build DUT Data block content
 */
export function buildDUTDataTemplate(fields: RequiredFields): string {
  const f = fields;
  const d = FIELD_DEFAULTS;

  return `\\DUTData{
%%%%%%%%%%%%   DUT 1 Fields    %%%%%%%%%%%%%
1 = {   Ref             = {${f.devices_under_test || d.devices_under_test}},
        Ref_s           = {${f.dut_name_short || d.dut_name_short}},
        Type            = {${f.dut_types || d.dut_types}},
        Samples         = {${f.dut_samples || d.dut_samples}},
        Type_short      = {${f.device_type || d.device_type}},  
        Test_Type       = {${f.dut_test_type || d.dut_test_type}},
        Package         = {${f.dut_package || d.dut_package}},
        Manufacturer    = {${f.dut_manufacturer || d.dut_manufacturer}},
        DC              = {${f.dut_date_code || d.dut_date_code}},
        LC              = ${f.dut_lot_code || d.dut_lot_code}},
2 = {   Ref             = {${d.devices_under_test}},
        Ref_s           = {${d.dut_name_short}},
        Type            = {${d.dut_types}},
        Samples         = {${d.dut_samples}},
        Type_short      = {${d.device_type}},  
        Test_Type       = {${d.dut_test_type}},
        Package         = {${d.dut_package}},
        Manufacturer    = {${d.dut_manufacturer}},
        DC              = {${d.dut_date_code}},
        LC              = ${d.dut_lot_code}}
}`;
}

/**
 * Parse facility string to determine which booleans to enable
 */
export function parseFacilities(facility?: string): Record<string, boolean> {
  const normalized = (facility || '').toLowerCase();
  const result: Record<string, boolean> = {};

  for (const f of FACILITIES) {
    result[f.key] = f.keywords.some((kw) => normalized.includes(kw));
  }

  return result;
}

// ============================================================================
// EDIT PATTERNS
// ============================================================================

/**
 * All edit patterns for the report initialization
 * Defines what patterns to search for and what content to replace them with
 */
export const EDIT_PATTERNS: EditPattern<RequiredFields>[] = [
  // 1. EDMS Number
  {
    name: 'edms_number',
    type: 'single',
    startPattern: /\\EDMSNumber/,
    buildContent: (fields) => `\\EDMSNumber{${fields.edms_number}}`,
    condition: (fields) => !!fields.edms_number,
    targetFile: 'Inputs/inputs.tex',
  },
  // 2. ResponsibilityData block
  {
    name: 'responsibility_data',
    type: 'block',
    startPattern: /\\ResponsibilityData\{/,
    endPattern: /^\}/,
    buildContent: buildResponsibilityDataTemplate,
    targetFile: 'Inputs/inputs.tex',
  },
  // 3. DUTData block
  {
    name: 'dut_data',
    type: 'block',
    startPattern: /\\DUTData\{/,
    endPattern: /^\}/,
    buildContent: buildDUTDataTemplate,
    targetFile: 'Inputs/inputs.tex',
  },
  // 4. Facility booleans
  ...FACILITIES.map((facility) => ({
    name: `facility_${facility.key}`,
    type: 'single' as const,
    startPattern: new RegExp(`\\\\setbool\\{${facility.boolName}\\}`),
    buildContent: (fields: RequiredFields) => {
      const flags = parseFacilities(fields.test_facility);
      return `\\setbool{${facility.boolName}}{${flags[facility.key]}}`;
    },
    targetFile: 'Inputs/inputs.tex',
  })),
];

// Type-safe config validation; ensures this config satisfies the contract
export const VALIDATED_CONFIG = validateReportConfig<
  RequiredFields,
  ReportInitializationState['sections']
>({
  targetFiles: INIT_TARGET_FILES,
  initialState: INITIAL_REPORT_STATE,
  editPatterns: EDIT_PATTERNS,
});
