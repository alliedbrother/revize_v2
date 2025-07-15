import React, { createContext, useContext, useState, useEffect } from 'react';

const ThemeContext = createContext();

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};

// Function to apply theme immediately to avoid flash
const applyTheme = (isDark) => {
  if (isDark) {
    document.body.classList.add('dark-theme');
  } else {
    document.body.classList.remove('dark-theme');
  }
};

// Initialize theme from localStorage immediately (before React renders)
const getInitialTheme = () => {
  try {
    const savedTheme = localStorage.getItem('revize-dark-mode');
    if (savedTheme !== null) {
      const isDark = JSON.parse(savedTheme);
      // Apply theme immediately to prevent flash
      applyTheme(isDark);
      return isDark;
    }
  } catch (error) {
    console.error('Error reading theme from localStorage:', error);
  }
  return false; // Default to light mode
};

export const ThemeProvider = ({ children }) => {
  // Initialize with the saved theme to prevent flash
  const [isDarkMode, setIsDarkMode] = useState(getInitialTheme);

  // Save theme to localStorage and apply it whenever it changes
  useEffect(() => {
    try {
      localStorage.setItem('revize-dark-mode', JSON.stringify(isDarkMode));
      applyTheme(isDarkMode);
    } catch (error) {
      console.error('Error saving theme to localStorage:', error);
    }
  }, [isDarkMode]);

  const toggleTheme = () => {
    setIsDarkMode(prev => !prev);
  };

  const value = {
    isDarkMode,
    toggleTheme
  };

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
}; 