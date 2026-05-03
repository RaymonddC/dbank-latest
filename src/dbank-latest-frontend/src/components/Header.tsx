import { useState } from 'react';
import { Menu, X, Wallet } from 'lucide-react';
import ThemeToggle from './ThemeToggle';
import WalletButton from './WalletButton';

const navLinkClass =
  'text-sm font-medium text-muted-foreground hover:text-foreground transition-colors';

const Header = () => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border bg-background/85 backdrop-blur supports-[backdrop-filter]:bg-background/70">
      <div className="container mx-auto px-4 py-4">
        <div className="flex items-center justify-between gap-4">
          <a href="/" className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-md bg-primary text-primary-foreground">
              <Wallet className="h-5 w-5" aria-hidden />
            </div>
            <span className="text-xl font-serif font-semibold tracking-tight text-foreground">
              ICP Finance
            </span>
          </a>

          <nav className="hidden md:flex items-center gap-7">
            <a href="#features" className={navLinkClass}>Features</a>
            <a href="#transactions" className={navLinkClass}>Transactions</a>
            <a href="#trust" className={navLinkClass}>Security</a>
            <div className="h-5 w-px bg-border" aria-hidden />
            <ThemeToggle />
            <WalletButton />
          </nav>

          <div className="md:hidden flex items-center gap-2">
            <ThemeToggle />
            <button
              type="button"
              className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-border text-foreground hover:bg-secondary transition-colors"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              aria-label={mobileMenuOpen ? 'Close menu' : 'Open menu'}
              aria-expanded={mobileMenuOpen}
              aria-controls="mobile-nav"
            >
              {mobileMenuOpen ? <X className="h-5 w-5" aria-hidden /> : <Menu className="h-5 w-5" aria-hidden />}
            </button>
          </div>
        </div>

        {mobileMenuOpen && (
          <nav id="mobile-nav" className="md:hidden mt-4 pb-2 flex flex-col gap-3 animate-fade-in">
            <a href="#features" className={navLinkClass} onClick={() => setMobileMenuOpen(false)}>Features</a>
            <a href="#transactions" className={navLinkClass} onClick={() => setMobileMenuOpen(false)}>Transactions</a>
            <a href="#trust" className={navLinkClass} onClick={() => setMobileMenuOpen(false)}>Security</a>
            <WalletButton fullWidth onAction={() => setMobileMenuOpen(false)} />
          </nav>
        )}
      </div>
    </header>
  );
};

export default Header;
