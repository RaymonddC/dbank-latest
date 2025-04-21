import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Menu, X, Wallet, ArrowRight } from 'lucide-react';
import ThemeToggle from './ThemeToggle';

const Header = () => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <header className="fixed top-0 left-0 right-0 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md z-50 border-b border-slate-200 dark:border-slate-800/70 transition-colors duration-300">
      <div className="container mx-auto px-4 py-4">
        <div className="flex items-center justify-between">
          {/* Logo */}
          <a href="/" className="flex items-center space-x-2">
            <div className="bg-gradient-to-r from-icp-blue to-icp-teal p-2 rounded-full shadow-lg transition-all duration-300">
              <Wallet className="h-6 w-6 text-white" />
            </div>
            <span className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-icp-blue to-icp-teal dark:from-icp-teal dark:to-icp-blue transition-all duration-300">ICP Finance</span>
          </a>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center space-x-6">
            <a href="#features" className="font-medium text-slate-700 dark:text-slate-200 hover:text-icp-teal dark:hover:text-icp-darkTeal transition-all duration-300">
              Features
            </a>
            <a href="#transactions" className="font-medium text-slate-700 dark:text-slate-200 hover:text-icp-teal dark:hover:text-icp-darkTeal transition-all duration-300">
              Transactions
            </a>
            <a href="#trust" className="font-medium text-slate-700 dark:text-slate-200 hover:text-icp-teal dark:hover:text-icp-darkTeal transition-all duration-300">
              Security
            </a>
            <ThemeToggle />
            <Button className="relative bg-gradient-to-r from-icp-blue via-icp-teal to-icp-blue bg-[size:200%_100%] bg-right-bottom hover:bg-left-bottom text-white font-medium shadow-md hover:shadow-lg transition-[background-position] duration-500 ease-in-out">
              Connect Wallet <ArrowRight className="ml-2 h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
            </Button>
          </nav>

          {/* Mobile Menu and Theme Toggle */}
          <div className="md:hidden flex items-center space-x-3">
            <ThemeToggle />
            <button className="text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 p-2 rounded-full transition-colors duration-300" onClick={() => setMobileMenuOpen(!mobileMenuOpen)}>
              {mobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
            </button>
          </div>
        </div>

        {/* Mobile Navigation */}
        {mobileMenuOpen && (
          <nav className="md:hidden py-4 flex flex-col space-y-4 animate-fade-in bg-white/95 dark:bg-slate-900/95 rounded-b-lg">
            <a href="#features" className="font-medium text-slate-700 dark:text-slate-200 hover:text-icp-teal dark:hover:text-icp-darkTeal transition-colors duration-200 px-2 py-1" onClick={() => setMobileMenuOpen(false)}>
              Features
            </a>
            <a href="#transactions" className="font-medium text-slate-700 dark:text-slate-200 hover:text-icp-teal dark:hover:text-icp-darkTeal transition-colors duration-200 px-2 py-1" onClick={() => setMobileMenuOpen(false)}>
              Transactions
            </a>
            <a href="#trust" className="font-medium text-slate-700 dark:text-slate-200 hover:text-icp-teal dark:hover:text-icp-darkTeal transition-colors duration-200 px-2 py-1" onClick={() => setMobileMenuOpen(false)}>
              Security
            </a>
            <Button className="w-full relative bg-gradient-to-r from-icp-blue via-icp-teal to-icp-blue bg-[size:200%_100%] bg-right-bottom hover:bg-left-bottom text-white font-medium shadow-md hover:shadow-lg transition-[background-position] duration-500 ease-in-out">
              Connect Wallet <ArrowRight className="ml-2 h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
            </Button>
          </nav>
        )}
      </div>
    </header>
  );
};

export default Header;
