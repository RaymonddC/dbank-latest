import { useState, useEffect } from 'react';
import { Sun, Moon } from 'lucide-react';
import { Button } from '@/components/ui/button';

const ThemeToggle = () => {
  const [theme, setTheme] = useState<'light' | 'dark'>('light');

  // Check for user's preferred theme
  useEffect(() => {
    const savedTheme = localStorage.getItem('theme') as 'light' | 'dark' | null;
    if (savedTheme) {
      setTheme(savedTheme);
      document.documentElement.classList.toggle('dark', savedTheme === 'dark');
    } else if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
      setTheme('dark');
      document.documentElement.classList.add('dark');
    }
  }, []);

  const toggleTheme = () => {
    const newTheme = theme === 'light' ? 'dark' : 'light';
    setTheme(newTheme);
    localStorage.setItem('theme', newTheme);
    document.documentElement.classList.toggle('dark', newTheme === 'dark');
  };

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={toggleTheme}
      className="relative h-9 w-9 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary"
      aria-label={theme === 'light' ? 'Switch to dark theme' : 'Switch to light theme'}
    >
      <Sun
        className={`absolute h-4 w-4 transition-all duration-300 ${
          theme === 'light' ? 'scale-0 opacity-0 -rotate-90' : 'scale-100 opacity-100 rotate-0'
        }`}
        aria-hidden
      />
      <Moon
        className={`absolute h-4 w-4 transition-all duration-300 ${
          theme === 'light' ? 'scale-100 opacity-100 rotate-0' : 'scale-0 opacity-0 rotate-90'
        }`}
        aria-hidden
      />
    </Button>
  );
};

export default ThemeToggle;
