import React, { createContext, useContext } from 'react';
import defaultTheme from './theme';

const ThemeContext = createContext(defaultTheme);

export function ThemeProvider({ theme, children }) {
  return <ThemeContext.Provider value={theme}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  return useContext(ThemeContext);
}
