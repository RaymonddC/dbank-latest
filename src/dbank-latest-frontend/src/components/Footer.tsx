import { Wallet, Twitter, Github } from 'lucide-react';

const Footer = () => {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="border-t border-border bg-background py-12">
      <div className="container mx-auto px-4">
        <div className="flex flex-col gap-8 md:flex-row md:items-start md:justify-between">
          <div className="max-w-sm">
            <div className="flex items-center gap-2.5 mb-3">
              <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary text-primary-foreground">
                <Wallet className="h-4 w-4" aria-hidden />
              </div>
              <span className="font-serif text-lg font-semibold tracking-tight text-foreground">ICP Finance</span>
            </div>
            <p className="text-sm text-muted-foreground">
              An open-source compounding wallet running entirely on the Internet Computer.
            </p>
          </div>

          <nav className="grid grid-cols-2 gap-12 sm:grid-cols-3" aria-label="Footer">
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wider text-foreground">Product</h3>
              <ul className="mt-4 space-y-2 text-sm">
                <li><a href="#features" className="text-muted-foreground hover:text-foreground">Features</a></li>
                <li><a href="#trust" className="text-muted-foreground hover:text-foreground">Security</a></li>
                <li><a href="#transactions" className="text-muted-foreground hover:text-foreground">Wallet</a></li>
              </ul>
            </div>
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wider text-foreground">Resources</h3>
              <ul className="mt-4 space-y-2 text-sm">
                <li><a href="https://internetcomputer.org" target="_blank" rel="noreferrer" className="text-muted-foreground hover:text-foreground">Internet Computer</a></li>
                <li><a href="https://identity.ic0.app" target="_blank" rel="noreferrer" className="text-muted-foreground hover:text-foreground">Internet Identity</a></li>
              </ul>
            </div>
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wider text-foreground">Connect</h3>
              <ul className="mt-4 space-y-2 text-sm">
                <li>
                  <a href="#" className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground">
                    <Github className="h-4 w-4" aria-hidden /> GitHub
                  </a>
                </li>
                <li>
                  <a href="#" className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground">
                    <Twitter className="h-4 w-4" aria-hidden /> Twitter
                  </a>
                </li>
              </ul>
            </div>
          </nav>
        </div>

        <div className="mt-10 pt-6 border-t border-border flex flex-col md:flex-row md:justify-between md:items-center gap-3 text-xs text-muted-foreground">
          <p>© {currentYear} ICP Finance. Open source under MIT.</p>
          <div className="flex gap-5">
            <a href="#" className="hover:text-foreground">Privacy</a>
            <a href="#" className="hover:text-foreground">Terms</a>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
