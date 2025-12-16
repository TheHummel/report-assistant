'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  ReportInitializationState,
  INITIAL_REPORT_STATE,
  SectionStatus,
} from '@/types/report-initialization';

const STORAGE_KEY = 'report-initialization-state';

export function useReportInitialization(projectId: string) {
  const storageKey = `${STORAGE_KEY}-${projectId}`;

  const [state, setState] =
    useState<ReportInitializationState>(INITIAL_REPORT_STATE);
  const [isLoaded, setIsLoaded] = useState(false);

  // load from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(storageKey);
      if (stored) {
        const parsed = JSON.parse(stored);
        setState({
          ...parsed,
          last_updated: parsed.last_updated
            ? new Date(parsed.last_updated)
            : undefined,
        });
      }
    } catch (error) {
      console.error('Failed to load report initialization state:', error);
    } finally {
      setIsLoaded(true);
    }
  }, [storageKey]);

  // save to localStorage whenever state changes
  useEffect(() => {
    if (isLoaded) {
      try {
        localStorage.setItem(storageKey, JSON.stringify(state));
      } catch (error) {
        console.error('Failed to save report initialization state:', error);
      }
    }
  }, [state, storageKey, isLoaded]);

  const updateRequiredField = useCallback(
    (
      key: keyof ReportInitializationState['required_fields'],
      value: string
    ) => {
      setState((prev) => ({
        ...prev,
        required_fields: {
          ...prev.required_fields,
          [key]: value,
        },
        last_updated: new Date(),
      }));
    },
    []
  );

  const updateSection = useCallback(
    (
      key: keyof ReportInitializationState['sections'],
      status: SectionStatus,
      content?: string
    ) => {
      setState((prev) => ({
        ...prev,
        sections: {
          ...prev.sections,
          [key]: {
            status,
            content,
          },
        },
        last_updated: new Date(),
      }));
    },
    []
  );

  const reset = useCallback(() => {
    setState(INITIAL_REPORT_STATE);
    try {
      localStorage.removeItem(storageKey);
    } catch (error) {
      console.error('Failed to clear report initialization state:', error);
    }
  }, [storageKey]);

  return {
    state,
    isLoaded,
    updateRequiredField,
    updateSection,
    reset,
  };
}
