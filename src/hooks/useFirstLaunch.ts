import { useState, useEffect, useCallback } from 'react';
import { safeParseJSON, safeStringifyJSON } from '@/lib/safeStorage';

interface FirstLaunchState {
  hasSeenOnboarding: boolean;
  hasSeenFeatureTour: boolean;
  hasSeenDashboardTips: boolean;
  completedSteps: string[];
  lastVisitedAt: string | null;
  visitCount: number;
}

const DEFAULT_STATE: FirstLaunchState = {
  hasSeenOnboarding: false,
  hasSeenFeatureTour: false,
  hasSeenDashboardTips: false,
  completedSteps: [],
  lastVisitedAt: null,
  visitCount: 0,
};

const STORAGE_KEY = 'alibrand-first-launch';

export function useFirstLaunch() {
  const [state, setState] = useState<FirstLaunchState>(() => {
    return safeParseJSON<FirstLaunchState>(STORAGE_KEY, DEFAULT_STATE);
  });

  const [isFirstVisit, setIsFirstVisit] = useState(false);

  useEffect(() => {
    // Check if this is truly the first visit
    const isFirst = state.visitCount === 0;
    setIsFirstVisit(isFirst);

    // Update visit count and last visited
    const newState = {
      ...state,
      visitCount: state.visitCount + 1,
      lastVisitedAt: new Date().toISOString(),
    };
    
    setState(newState);
    safeStringifyJSON(STORAGE_KEY, newState);
  }, []);

  const markOnboardingComplete = useCallback(() => {
    setState(prev => {
      const newState = { ...prev, hasSeenOnboarding: true };
      safeStringifyJSON(STORAGE_KEY, newState);
      return newState;
    });
  }, []);

  const markFeatureTourComplete = useCallback(() => {
    setState(prev => {
      const newState = { ...prev, hasSeenFeatureTour: true };
      safeStringifyJSON(STORAGE_KEY, newState);
      return newState;
    });
  }, []);

  const markDashboardTipsComplete = useCallback(() => {
    setState(prev => {
      const newState = { ...prev, hasSeenDashboardTips: true };
      safeStringifyJSON(STORAGE_KEY, newState);
      return newState;
    });
  }, []);

  const markStepComplete = useCallback((stepId: string) => {
    setState(prev => {
      if (prev.completedSteps.includes(stepId)) return prev;
      const newState = {
        ...prev,
        completedSteps: [...prev.completedSteps, stepId],
      };
      safeStringifyJSON(STORAGE_KEY, newState);
      return newState;
    });
  }, []);

  const isStepComplete = useCallback((stepId: string) => {
    return state.completedSteps.includes(stepId);
  }, [state.completedSteps]);

  const resetOnboarding = useCallback(() => {
    setState(DEFAULT_STATE);
    safeStringifyJSON(STORAGE_KEY, DEFAULT_STATE);
  }, []);

  return {
    ...state,
    isFirstVisit,
    markOnboardingComplete,
    markFeatureTourComplete,
    markDashboardTipsComplete,
    markStepComplete,
    isStepComplete,
    resetOnboarding,
  };
}
