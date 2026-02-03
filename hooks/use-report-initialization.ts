'use client';

import { useState, useEffect, useCallback } from 'react';
import type { SectionStatus } from '@/report-templates/report-init-types';
import { getTemplateInitialState } from '@/lib/template-config';

const STORAGE_KEY = 'report-initialization-state';

interface GenericReportInitializationState {
  required_fields: Record<string, unknown>;
  sections: Record<string, { status: SectionStatus; content?: string }>;
  other: Record<string, unknown>;
  completed: boolean;
  last_updated?: Date;
}

export function useReportInitialization(
  projectId: string,
  templateId?: string | null
) {
  const storageKey = `${STORAGE_KEY}-${projectId}`;

  const [state, setState] = useState<GenericReportInitializationState>({
    required_fields: {},
    sections: {},
    other: {},
    completed: false,
  });
  const [isLoaded, setIsLoaded] = useState(false);
  const [isLoadingConfig, setIsLoadingConfig] = useState(true);

  // Load template config and init state
  useEffect(() => {
    async function loadInitialState() {
      setIsLoadingConfig(true);
      const templateInitState = await getTemplateInitialState(templateId);
      const initialState: GenericReportInitializationState = {
        required_fields: {},
        sections: {},
        other: {},
        completed: false,
        ...(templateInitState as Partial<GenericReportInitializationState>),
      };

      // try loading from localStorage
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
        } else {
          // no stored state, use initial state for this template
          setState(initialState);
        }
      } catch (error) {
        console.error('Failed to load state from localStorage:', error);
        setState(initialState);
      }

      setIsLoaded(true);
      setIsLoadingConfig(false);
    }

    loadInitialState();
  }, [projectId, templateId, storageKey]);

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

  const updateRequiredField = useCallback((key: string, value: string) => {
    setState((prev) => ({
      ...prev,
      required_fields: {
        ...prev.required_fields,
        [key]: value,
      },
      last_updated: new Date(),
    }));
  }, []);

  const updateSection = useCallback(
    (key: string, status: SectionStatus, content?: string) => {
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
    const resetState = {
      required_fields: {},
      sections: {},
      other: {},
      completed: false,
    };
    setState(resetState);
    try {
      localStorage.removeItem(storageKey);
    } catch (error) {
      console.error('Failed to clear report initialization state:', error);
    }
  }, [storageKey]);

  return {
    state,
    isLoaded,
    isLoadingConfig,
    updateRequiredField,
    updateSection,
    reset,
  };
}
