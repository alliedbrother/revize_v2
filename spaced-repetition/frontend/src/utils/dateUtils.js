/**
 * Date utility functions to handle timezone issues
 */

/**
 * Parse a date string correctly as a local date instead of UTC
 * This fixes the issue where "2025-07-15" gets parsed as UTC and displays as the previous day
 * @param {string} dateString - Date string in YYYY-MM-DD format
 * @returns {Date} - Date object in local timezone
 */
export const parseDate = (dateString) => {
  if (!dateString) return null;
  
  const [year, month, day] = dateString.split('-').map(Number);
  return new Date(year, month - 1, day); // month is 0-indexed
};

/**
 * Format a date string for display
 * @param {string} dateString - Date string in YYYY-MM-DD format
 * @param {object} options - Intl.DateTimeFormat options
 * @returns {string} - Formatted date string
 */
export const formatDate = (dateString, options = {}) => {
  if (!dateString) return '';
  
  const date = parseDate(dateString);
  if (!date) return '';
  
  const defaultOptions = {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  };
  
  return date.toLocaleDateString('en-US', { ...defaultOptions, ...options });
};

/**
 * Format a date string for display with full month name
 * @param {string} dateString - Date string in YYYY-MM-DD format
 * @returns {string} - Formatted date string with full month name
 */
export const formatDateLong = (dateString) => {
  return formatDate(dateString, {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
};

/**
 * Format a date string for display with short format
 * @param {string} dateString - Date string in YYYY-MM-DD format
 * @returns {string} - Formatted date string in short format
 */
export const formatDateShort = (dateString) => {
  return formatDate(dateString, {
    year: 'numeric',
    month: 'numeric',
    day: 'numeric'
  });
};

/**
 * Check if a date string is today
 * @param {string} dateString - Date string in YYYY-MM-DD format
 * @returns {boolean} - True if the date is today
 */
export const isToday = (dateString) => {
  if (!dateString) return false;
  
  const date = parseDate(dateString);
  const today = new Date();
  
  return date.toDateString() === today.toDateString();
};

/**
 * Check if a date string is in the past
 * @param {string} dateString - Date string in YYYY-MM-DD format
 * @returns {boolean} - True if the date is in the past
 */
export const isPast = (dateString) => {
  if (!dateString) return false;
  
  const date = parseDate(dateString);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  return date < today;
};

/**
 * Get the difference in days between two dates
 * @param {string} dateString1 - First date string in YYYY-MM-DD format
 * @param {string} dateString2 - Second date string in YYYY-MM-DD format
 * @returns {number} - Difference in days
 */
export const daysDifference = (dateString1, dateString2) => {
  if (!dateString1 || !dateString2) return 0;
  
  const date1 = parseDate(dateString1);
  const date2 = parseDate(dateString2);
  
  const diffTime = Math.abs(date2 - date1);
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  
  return diffDays;
};

/**
 * Format a UTC timestamp string to local date and time
 * @param {string} timestampString - UTC timestamp string (e.g., "2025-07-15T19:35:40.946777Z")
 * @param {object} options - Intl.DateTimeFormat options
 * @returns {string} - Formatted date and time string in local timezone
 */
export const formatDateTime = (timestampString, options = {}) => {
  if (!timestampString) return '';
  
  const date = new Date(timestampString);
  if (isNaN(date.getTime())) return '';
  
  const defaultOptions = {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  };
  
  return date.toLocaleString('en-US', { ...defaultOptions, ...options });
};

/**
 * Format a UTC timestamp string to local date only
 * @param {string} timestampString - UTC timestamp string
 * @returns {string} - Formatted date string in local timezone
 */
export const formatDateFromTimestamp = (timestampString) => {
  if (!timestampString) return '';
  
  const date = new Date(timestampString);
  if (isNaN(date.getTime())) return '';
  
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
};

/**
 * Format a UTC timestamp string to local time only
 * @param {string} timestampString - UTC timestamp string
 * @returns {string} - Formatted time string in local timezone
 */
export const formatTimeFromTimestamp = (timestampString) => {
  if (!timestampString) return '';
  
  const date = new Date(timestampString);
  if (isNaN(date.getTime())) return '';
  
  return date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  });
};

/**
 * Get the user's current timezone
 * @returns {string} - User's timezone (e.g., "America/New_York")
 */
export const getUserTimezone = () => {
  return Intl.DateTimeFormat().resolvedOptions().timeZone;
};

/**
 * Get the current date in user's timezone in YYYY-MM-DD format
 * @returns {string} - Current date in YYYY-MM-DD format
 */
export const getCurrentDateString = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}; 