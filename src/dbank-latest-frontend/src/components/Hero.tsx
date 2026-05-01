import { ArrowRight, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';

const Hero = () => {
  const scrollToTransactions = () => {
    const element = document.getElementById('transactions');
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <section className="relative pt-24 pb-20 md:pt-32 md:pb-28 overflow-hidden">
      <div className="container mx-auto px-4">
        <div className="max-w-3xl mx-auto text-center space-y-8">
          <div className="inline-flex items-center gap-2 rounded-full border border-border bg-card/60 px-3 py-1 text-xs text-muted-foreground">
            <span className="h-1.5 w-1.5 rounded-full bg-accent" aria-hidden />
            On-chain · Internet Identity · 1% daily compounding
          </div>

          <h1 className="font-serif text-4xl md:text-6xl font-medium leading-[1.05] tracking-tight text-foreground">
            A simple, on-chain wallet
            <br />
            <span className="text-accent">that compounds every second.</span>
          </h1>

          <p className="mx-auto max-w-xl text-lg text-muted-foreground">
            Sign in with Internet Identity, top up in ICP, and watch your balance grow continuously. No accounts, no passwords, no custodian.
          </p>

          <div className="flex flex-col sm:flex-row justify-center gap-3 pt-2">
            <Button size="lg" onClick={scrollToTransactions} className="group h-11 px-6 text-base">
              Get Started
              <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-0.5" aria-hidden />
            </Button>
            <Button asChild size="lg" variant="outline" className="h-11 px-6 text-base">
              <a href="#features">Learn more</a>
            </Button>
          </div>

          <div className="pt-12">
            <a href="#features" className="inline-flex items-center justify-center text-muted-foreground/60 hover:text-foreground transition-colors" aria-label="Scroll to features">
              <ChevronDown className="h-6 w-6 animate-bounce" aria-hidden />
            </a>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Hero;
