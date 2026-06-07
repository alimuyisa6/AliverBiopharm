import { useThemeContext } from '@context/ThemeContext';

const useTheme = () => {
  const { darkMode, toggleTheme } = useThemeContext();
  return { darkMode, toggleTheme, isDark: darkMode };
};

export default useTheme;
