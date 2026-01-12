# Report Initialization

This folder contains the configuration for setting up the automated report initialization for an existing report template.

## File Structure

```
shared/
├── report-init-types.ts          # Generic interfaces/contracts (NEVER modify)
├── report-init-config.ts          # Radiation test report config (current)
├── report-init-config.example.ts  # Template for creating new configs
└── README.md                      # This file
```

## Architecture

### Generic (Framework) Files

**`report-init-types.ts`** - Generic type contracts

- `EditPattern` - Interface for edit patterns
- `SectionStatus`, `ReportSection` - Section status types
- `ReportInitConfig` - Complete config interface

**Do NOT modify** these unless changing the core initialization system.

## Creating a New Report Type

1. **Copy the template:**

   ```bash
   cp report-init-config.example.ts my-report-config.ts
   ```

2. **Customize the config:**
   - Define `RequiredFields` interface
   - Define `ReportInitializationState` sections
   - Set `INIT_TARGET_FILES` to your target files
   - Define `FIELD_DEFAULTS` for placeholders
   - Create `REPORT_QUESTIONS` for UI
   - Define `EDIT_PATTERNS` for modifications

3. **Update imports** in your application to use the new config

4. **Test** the initialization flow

## Key Concepts

### Target Files

```typescript
export const INIT_TARGET_FILES = ['path/to/file.tex'];
```

List of files to be modified during initialization (relative to `public/report-template/`).

### Report Template Location

The report template should be placed in:

```
public/report-template/
```

All paths in `INIT_TARGET_FILES` are relative to this template root directory.

For example, if your template structure is:

```
public/report-template/
├── Report.tex
├── Inputs/
│   └── inputs.tex
└── Sections/
    └── introduction.tex
```

Then your target files would be:

```typescript
export const INIT_TARGET_FILES = ['Inputs/inputs.tex'];
```

### Edit Patterns

To predefine detgerministic edit suggestions which are suggested regardless of LLM-based suggestions one can set edit patterns.

Define **what** gets modified and **how**:

```typescript
{
  name: 'field_name',
  type: 'single',  // or 'block'
  startPattern: /\\LaTeXCommand/,
  endPattern: /\\end/,  // for block type
  buildContent: (fields) => `\\LaTeXCommand{${fields.value}}`,
  condition: (fields) => !!fields.value,  // optional
  targetFile: 'path/to/file.tex',  // REQUIRED: must match INIT_TARGET_FILES exactly
}
```

**Types:**

- `single` - Replace a single line
- `block` - Replace everything between start and end patterns

**Target File:**

- Every pattern must specify which file it targets
- Must match a path from `INIT_TARGET_FILES` exactly (e.g., `'Inputs/inputs.tex'`)
- Use the exact path as defined in `INIT_TARGET_FILES`

### Template Builders

For complex multi-line structures:

```typescript
function buildMyTemplate(fields: RequiredFields): string {
  return `\\begin{structure}
  ${fields.field1}
  ${fields.field2}
\\end{structure}`;
}
```

## How It Works

1. **User fills checklist** → `ReportInitializationState` populated
2. **Backend receives state** → finds target files from `INIT_TARGET_FILES`
3. **For each file** → processes all `EDIT_PATTERNS`
4. **For each pattern** → searches file, generates content, creates edit
5. **Edits returned** → frontend applies them to files

## Example: Adding a New Field

1. **Add to `RequiredFields`:**

   ```typescript
   export interface RequiredFields extends Record<string, unknown> {
     // ... existing fields
     new_field?: string;
   }
   ```

2. **Add default value:**

   ```typescript
   export const FIELD_DEFAULTS = {
     // ... existing defaults
     new_field: '*Default Value*',
   };
   ```

3. **Add question:**

   ```typescript
   export const REPORT_QUESTIONS = [
     // ... existing questions
     {
       key: 'new_field',
       question: 'What is the new field value?',
       topic: 'New Field',
       category: 'required_fields',
     },
   ];
   ```

4. **Add edit pattern:**
   ```typescript
   export const EDIT_PATTERNS = [
     // ... existing patterns
     {
       name: 'new_field',
       type: 'single',
       startPattern: /\\NewCommand/,
       buildContent: (fields) =>
         `\\NewCommand{${fields.new_field || FIELD_DEFAULTS.new_field}}`,
       targetFile: 'Inputs/inputs.tex',
     },
   ];
   ```

## Type Safety & Validation

### Compile-Time Contract Enforcement

To ensure your config satisfies the `ReportInitConfig` interface, add validation:

```typescript
import { validateReportConfig } from './report-init-types';

export const VALIDATED_CONFIG = validateReportConfig({
  targetFiles: INIT_TARGET_FILES,
  initialState: INITIAL_REPORT_STATE,
  editPatterns: EDIT_PATTERNS,
});
```

**Example errors:**

```typescript
// ❌ Missing required property:
// Error: Property 'editPatterns' is missing

// ❌ Wrong type:
// Error: Type 'string' is not assignable to type 'readonly string[]'

// ❌ Extra property:
// Error: Object literal may only specify known properties
```

<!-- ### Enforcing Validation in CI/CD

Add type-checking to your build process:

```json
// package.json
{
  "scripts": {
    "type-check": "tsc --noEmit && cd agent_server && tsc --noEmit",
    "build": "npm run type-check && next build",
    "test": "npm run type-check && vitest run"
  }
}
```

This ensures all configs are valid before deployment. -->

## Existing Report Configs

**`report-init-config.ts`** - CERN Radiation Test Report configuration

<!-- ## Best Practices

- **Keep types generic** in `report-init-types.ts`
- **Keep report logic** in report-specific config files
- **Always validate configs** with `validateReportConfig()`
- **Document LaTeX patterns** with comments
- **Test edit patterns** with real report files
- **Use template builders** for complex structures
- **Add conditions** to skip optional fields
- **Keep defaults** clear and obvious (e.g., `*Placeholder*`) -->
