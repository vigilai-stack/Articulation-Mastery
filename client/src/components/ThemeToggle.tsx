import { useTheme } from "@/contexts/ThemeContext";
import { Moon, Sun } from "lucide-react";

export default function ThemeToggle({ compact = false }: { compact?: boolean }) {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === "dark";
  return <button onClick={toggleTheme} className={`theme-toggle ${compact ? "theme-toggle--compact" : ""}`} aria-label={`Switch to ${isDark ? "light" : "dark"} mode`} title={`Switch to ${isDark ? "light" : "dark"} mode`}><span className="theme-toggle__track">{isDark ? <Moon className="h-3.5 w-3.5"/> : <Sun className="h-3.5 w-3.5"/>}</span><span className="hidden sm:inline">{isDark ? "Dark" : "Light"}</span></button>;
}
