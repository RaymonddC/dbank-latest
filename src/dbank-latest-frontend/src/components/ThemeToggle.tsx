
import { useState, useEffect } from "react";
import { Sun, Moon } from "lucide-react";
import { Button } from "@/components/ui/button";

const ThemeToggle = () => {
  const [theme, setTheme] = useState<"light" | "dark">("light");

  // Check for user's preferred theme
  useEffect(() => {
    const savedTheme = localStorage.getItem("theme") as "light" | "dark" | null;
    if (savedTheme) {
      setTheme(savedTheme);
      document.documentElement.classList.toggle("dark", savedTheme === "dark");
    } else if (window.matchMedia("(prefers-color-scheme: dark)").matches) {
      setTheme("dark");
      document.documentElement.classList.add("dark");
    }
  }, []);

  const toggleTheme = () => {
    const newTheme = theme === "light" ? "dark" : "light";
    setTheme(newTheme);
    localStorage.setItem("theme", newTheme);
    document.documentElement.classList.toggle("dark", newTheme === "dark");
  };

  return (
    <Button 
      variant="ghost" 
      size="icon" 
      onClick={toggleTheme}
      className="rounded-full w-10 h-10 bg-slate-100 text-slate-700 hover:text-white hover:bg-icp-teal dark:bg-slate-700/90 dark:text-white dark:hover:text-white dark:hover:bg-icp-darkTeal shadow-sm hover:shadow-md transition-all duration-200"
      aria-label="Toggle theme"
    >
      {theme === "light" ? 
        <Moon className="h-5 w-5 transition-transform duration-200 hover:rotate-12" /> : 
        <Sun className="h-5 w-5 transition-transform duration-200 hover:rotate-90" />
      }
    </Button>
  );
};

export default ThemeToggle;
