import Header from '@/components/Header';
import Hero from '@/components/Hero';
import Features from '@/components/Features';
import TransactionCard from '@/components/TransactionCard';
import TrustSection from '@/components/TrustSection';
import Footer from '@/components/Footer';
import { InterestInfo } from '@/components/InterestInfo';
import { useLimits } from '@/hooks/useLimits';

const Index = () => {
  const { accrueInterest } = useLimits();

  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground">
      <Header />

      <main className="flex-grow">
        <Hero />

        {accrueInterest && (
          <section className="py-24 border-t border-border">
            <div className="container mx-auto px-4">
              <div className="max-w-2xl mb-14">
                <h2 className="font-serif text-3xl md:text-4xl font-medium tracking-tight text-foreground">
                  One percent. Every day.
                </h2>
                <p className="mt-3 text-lg text-muted-foreground">
                  Interest accrues every second using a per-second rate of{' '}
                  <span className="font-mono">1.01<sup>1/86400</sup></span>. The math compounds to exactly the headline rate.
                </p>
              </div>
              <InterestInfo />
            </div>
          </section>
        )}

        <Features />

        <section id="transactions" className="py-24 border-t border-border bg-secondary/40">
          <div className="container mx-auto px-4">
            <div className="max-w-2xl mb-14">
              <h2 className="font-serif text-3xl md:text-4xl font-medium tracking-tight text-foreground">
                Move ICP in or out.
              </h2>
              <p className="mt-3 text-lg text-muted-foreground">
                Sign in once, then deposit ICP to your custody address and withdraw to any ICRC-1 account. Every action is signed by your principal and settled on-chain.
              </p>
            </div>
            <TransactionCard />
          </div>
        </section>

        <TrustSection />
      </main>

      <Footer />
    </div>
  );
};

export default Index;
