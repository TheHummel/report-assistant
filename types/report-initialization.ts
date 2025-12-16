export type SectionStatus = 'missing' | 'partial' | 'complete';

export interface ReportSection {
  status: SectionStatus;
  content?: string;
}

export interface ReportInitializationState {
  // required fields from the template
  required_fields: {
    test_facility?: string; // PSI, Cobalt-60, or CHARM
    test_date?: string;
    report_author?: string;
    devices_under_test?: string;
    dut_types?: string;
    dut_manufacturer?: string;
    dut_package?: string;
    irradiation_conditions?: string;
  };

  // sections tracking
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

  // metadata
  completed: boolean;
  last_updated?: Date;
}

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

// questions the agent shall ask
export const REPORT_QUESTIONS = [
  {
    key: 'test_facility',
    question: 'Which test facility was used? (PSI, Cobalt-60, or CHARM)',
    topic: 'Test Facility',
    category: 'required_fields',
  },
  {
    key: 'test_date',
    question: 'What were the test campaign dates?',
    topic: 'Test Dates',
    category: 'required_fields',
  },
  {
    key: 'report_author',
    question: 'Who are the report authors?',
    topic: 'Report Authors',
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
