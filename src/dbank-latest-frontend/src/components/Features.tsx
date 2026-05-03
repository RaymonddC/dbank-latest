import { Shield, Zap, RefreshCw, Globe } from 'lucide-react';

const features = [
  {
    icon: Zap,
    title: 'Instant transactions',
    description: 'Top-ups and withdrawals settle on-chain in seconds.',
  },
  {
    icon: Shield,
    title: 'Custody-free',
    description: 'Your principal owns the balance. No password, no custodian.',
  },
  {
    icon: RefreshCw,
    title: 'Always compounding',
    description: 'Interest accrues every second using a per-second rate.',
  },
  {
    icon: Globe,
    title: 'Global by default',
    description: 'Access your wallet from any browser, anywhere.',
  },
];

const Features = () => {
  return (
    <section id="features" className="py-24 border-t border-border">
      <div className="container mx-auto px-4">
        <div className="max-w-2xl mb-14">
          <h2 className="font-serif text-3xl md:text-4xl font-medium tracking-tight text-foreground">
            Built for clarity and trust.
          </h2>
          <p className="mt-3 text-lg text-muted-foreground">
            Every interaction is signed by your Internet Identity and reflected on-chain.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-px overflow-hidden rounded-[var(--radius)] border border-border bg-border">
          {features.map(({ icon: Icon, title, description }) => (
            <div key={title} className="bg-card p-8 transition-colors hover:bg-secondary/40">
              <Icon className="h-6 w-6 text-accent" aria-hidden />
              <h3 className="mt-5 text-base font-semibold text-foreground">{title}</h3>
              <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default Features;
