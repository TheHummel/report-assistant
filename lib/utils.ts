import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import type { CompilationError } from '@/types/compilation';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCompilationErrorForAI(error: CompilationError): string {
  const errorContext = [
    `LaTeX Compilation Error:`,
    `${error.message}`,
    error.details && `\nDetails: ${error.details}`,
    error.summary && `\nError Summary:\n${error.summary}`,
    error.log &&
      `\nLog (last lines):\n${error.log.split('\n').slice(-20).join('\n')}`,
  ]
    .filter(Boolean)
    .join('\n');

  return errorContext;
}

export function formatCompilationErrorForClipboard(
  error: CompilationError
): string {
  const errorText = [
    `Error: ${error.message}`,
    error.details && `Details: ${error.details}`,
    error.requestId && `Request ID: ${error.requestId}`,
    typeof error.queueMs === 'number' && `Queue: ${error.queueMs}ms`,
    typeof error.durationMs === 'number' && `Duration: ${error.durationMs}ms`,
    error.summary && `Summary:\n${error.summary}`,
    error.log && `Log:\n${error.log}`,
    error.stdout && `Output:\n${error.stdout}`,
    error.stderr && `Errors:\n${error.stderr}`,
  ]
    .filter(Boolean)
    .join('\n\n');

  return errorText;
}
