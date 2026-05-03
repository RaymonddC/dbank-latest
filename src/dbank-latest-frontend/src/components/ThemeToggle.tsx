import { useState, useEffect } from 'react';
import { Sun, Moon } from 'lucide-react';
import { Button } from '@/components/ui/button';

const ThemeToggle = () => {
  const [theme, setTheme] = useState<'light' | 'dark'>('light');

  useEffect(() => {
    const saved = localStorage.getItem('theme') as 'light' | 'dark' | null;
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const apply = (next: 'light' | 'dark') => {
      setTheme(next);
      document.documentElement.classList.toggle('dark', next === 'dark');
    };

    apply(saved ?? (media.matches ? 'dark' : 'light'));

    // If the user hasn't explicitly chosen a theme, follow OS changes live.
    const onChange = (e: MediaQueryListEvent) => {
      if (localStorage.getItem('theme') === null) {
        apply(e.matches ? 'dark' : 'light');
      }
    };
    media.addEventListener('change', onChange);
    return () => media.removeEventListener('change', onChange);
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
