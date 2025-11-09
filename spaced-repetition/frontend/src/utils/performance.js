/**
 * Performance Monitoring Utilities
 * Track and optimize application performance
 */

/**
 * Debounce function
 * Delays execution until after wait time has elapsed since last call
 */
export const debounce = (func, wait = 300) => {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
};

/**
 * Throttle function
 * Ensures function is called at most once per specified time period
 */
export const throttle = (func, limit = 300) => {
  let inThrottle;
  return function executedFunction(...args) {
    if (!inThrottle) {
      func(...args);
      inThrottle = true;
      setTimeout(() => (inThrottle = false), limit);
    }
  };
};

/**
 * Measure component render time
 * Usage: const measureTime = measureRenderTime('ComponentName');
 *        // ... component logic
 *        measureTime();
 */
export const measureRenderTime = (componentName) => {
  const startTime = performance.now();
  return () => {
    const endTime = performance.now();
    const renderTime = endTime - startTime;
    if (renderTime > 16) {  // Warn if render takes longer than 16ms (60fps)
      console.warn(`${componentName} render took ${renderTime.toFixed(2)}ms`);
    }
  };
};

/**
 * Intersection Observer hook for lazy loading images/components
 * Returns ref to attach to element and boolean indicating if visible
 */
export const useIntersectionObserver = (options = {}) => {
  const defaultOptions = {
    threshold: 0.1,
    rootMargin: '50px',
    ...options,
  };

  return (element) => {
    if (!element) return;

    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          // Element is visible, load content
          if (element.dataset.src) {
            element.src = element.dataset.src;
            element.removeAttribute('data-src');
          }
          observer.unobserve(element);
        }
      });
    }, defaultOptions);

    observer.observe(element);

    return () => observer.disconnect();
  };
};

/**
 * Memoization helper
 * Cache expensive function results
 */
export const memoize = (fn) => {
  const cache = new Map();
  return (...args) => {
    const key = JSON.stringify(args);
    if (cache.has(key)) {
      return cache.get(key);
    }
    const result = fn(...args);
    cache.set(key, result);
    return result;
  };
};

/**
 * Batch state updates
 * Reduces re-renders by batching multiple state changes
 */
export const batchUpdates = (callback) => {
  // React 18+ automatically batches updates
  // This is a wrapper for explicit batching if needed
  if (typeof callback === 'function') {
    callback();
  }
};

/**
 * Check if device is low-end
 * Useful for conditionally loading heavy features
 */
export const isLowEndDevice = () => {
  // Check for slow connection
  if (navigator.connection) {
    const { effectiveType, saveData } = navigator.connection;
    if (saveData || effectiveType === 'slow-2g' || effectiveType === '2g') {
      return true;
    }
  }

  // Check for low memory (< 4GB)
  if (navigator.deviceMemory && navigator.deviceMemory < 4) {
    return true;
  }

  // Check for low CPU cores
  if (navigator.hardwareConcurrency && navigator.hardwareConcurrency < 4) {
    return true;
  }

  return false;
};

/**
 * Prefetch route data
 * Call this on link hover to speed up navigation
 */
export const prefetchData = async (fetchFunction) => {
  if ('requestIdleCallback' in window) {
    requestIdleCallback(() => fetchFunction());
  } else {
    setTimeout(fetchFunction, 1);
  }
};

/**
 * Virtual scroll calculator
 * Calculate visible items for large lists
 */
export const calculateVisibleItems = (scrollTop, itemHeight, containerHeight, totalItems) => {
  const startIndex = Math.floor(scrollTop / itemHeight);
  const endIndex = Math.min(
    Math.ceil((scrollTop + containerHeight) / itemHeight),
    totalItems
  );

  return {
    startIndex: Math.max(0, startIndex - 5), // Buffer items
    endIndex: Math.min(totalItems, endIndex + 5), // Buffer items
  };
};

/**
 * Image optimization helper
 * Returns optimized image URL based on device
 */
export const getOptimizedImageUrl = (baseUrl, options = {}) => {
  const {
    width = window.innerWidth,
    quality = 80,
    format = 'webp',
  } = options;

  // Adjust for device pixel ratio
  const dpr = window.devicePixelRatio || 1;
  const optimizedWidth = Math.ceil(width * dpr);

  // Return URL with optimization parameters
  // Adjust this based on your image CDN
  return `${baseUrl}?w=${optimizedWidth}&q=${quality}&f=${format}`;
};

/**
 * Report Web Vitals to analytics
 */
export const reportWebVitals = (metric) => {
  // Log to console in development
  if (process.env.NODE_ENV === 'development') {
    console.log(metric);
  }

  // Send to analytics in production
  if (process.env.NODE_ENV === 'production') {
    // Example: Google Analytics
    // window.gtag?.('event', metric.name, {
    //   value: Math.round(metric.value),
    //   event_label: metric.id,
    //   non_interaction: true,
    // });
  }
};

export default {
  debounce,
  throttle,
  measureRenderTime,
  useIntersectionObserver,
  memoize,
  batchUpdates,
  isLowEndDevice,
  prefetchData,
  calculateVisibleItems,
  getOptimizedImageUrl,
  reportWebVitals,
};
