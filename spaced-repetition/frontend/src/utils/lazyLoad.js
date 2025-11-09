/**
 * Lazy Loading Utilities
 * For code splitting and dynamic imports
 */

import { lazy } from 'react';

/**
 * Retry lazy loading with exponential backoff
 * Useful for handling network failures
 */
export const lazyWithRetry = (importFunc, retries = 3, interval = 1000) => {
  return lazy(() => {
    return new Promise((resolve, reject) => {
      const attemptImport = (remainingRetries) => {
        importFunc()
          .then(resolve)
          .catch((error) => {
            if (remainingRetries === 0) {
              reject(error);
              return;
            }

            console.log(`Retrying import... (${retries - remainingRetries + 1}/${retries})`);

            setTimeout(() => {
              attemptImport(remainingRetries - 1);
            }, interval * (retries - remainingRetries + 1)); // Exponential backoff
          });
      };

      attemptImport(retries);
    });
  });
};

/**
 * Preload a lazy component
 * Call this on hover or when you know the component will be needed soon
 */
export const preloadComponent = (lazyComponent) => {
  const Component = lazyComponent._payload?._result;
  if (!Component) {
    lazyComponent._payload?._result?.();
  }
};

/**
 * Example usage:
 *
 * // In your routes or component imports:
 * const Statistics = lazyWithRetry(() => import('./components/dashboard/Statistics'));
 * const FlashcardReview = lazyWithRetry(() => import('./components/flashcards/FlashcardReviewSession'));
 *
 * // Preload on hover:
 * <button
 *   onMouseEnter={() => preloadComponent(Statistics)}
 *   onClick={() => navigate('/stats')}
 * >
 *   Statistics
 * </button>
 */

export default lazyWithRetry;
