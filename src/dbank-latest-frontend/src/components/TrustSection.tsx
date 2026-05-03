import { Shield, Lock, CheckCircle, Award } from 'lucide-react';

const points = [
  {
    icon: Shield,
    title: 'Cryptographic delegation',
    description: 'Internet Identity issues a per-app delegation key — never your password. Sessions are revocable and time-bound.',
  },
  {
    icon: Lock,
    title: 'On-chain custody',
    description: 'Balances live in canister state on the Internet Computer. Only your principal can move funds.',
  },
  {
    icon: CheckCircle,
    title: 'Reproducible builds',
    description: 'Every release is built deterministically and the canister hash is publicly verifiable.',
  },
  {
    icon: Award,
    title: 'Open source',
    description: 'The smart contract is small, auditable, and written in Motoko. Read every line before you sign in.',
  },
];

const TrustSection = () => {
  return (
    <section id="trust" className="py-24 border-t border-border bg-secondary/30">
      <div className="container mx-auto px-4">
        <div className="max-w-2xl mb-14">
          <h2 className="font-serif text-3xl md:text-4xl font-medium tracking-tight text-foreground">
            Security you can read.
          </h2>
          <p className="mt-3 text-lg text-muted-foreground">
            No password databases. No off-chain custody. Just a small, auditable canister.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-px overflow-hidden rounded-[var(--radius)] border border-border bg-border">
          {points.map(({ icon: Icon, title, description }) => (
            <div key={title} className="bg-card p-8">
              <Icon className="h-5 w-5 text-accent" aria-hidden />
              <h3 className="mt-4 text-base font-semibold text-foreground">{title}</h3>
              <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default TrustSection;
