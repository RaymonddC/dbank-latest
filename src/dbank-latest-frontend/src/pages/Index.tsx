import Header from '@/components/Header';
import Hero from '@/components/Hero';
import Features from '@/components/Features';
import TransactionCard from '@/components/TransactionCard';
import TrustSection from '@/components/TrustSection';
import Footer from '@/components/Footer';
import { InterestInfo } from '@/components/InterestInfo';

const Index = () => {
  return (
    <div className="min-h-screen flex flex-col bg-white dark:bg-slate-950 transition-colors duration-300">
      <Header />

      <main className="flex-grow">
        <Hero />

        <section className="py-16 bg-white dark:bg-slate-900 relative overflow-hidden transition-colors duration-300">
          <div className="container mx-auto px-4">
            <div className="text-center mb-12">
              <h2 className="text-3xl md:text-4xl font-bold mb-4 bg-clip-text text-transparent bg-gradient-to-r from-icp-blue to-icp-teal dark:from-white dark:to-icp-darkTeal drop-shadow-sm">Interest Rates</h2>
              <p className="text-xl text-slate-600 dark:text-slate-200 max-w-2xl mx-auto">Earn compound interest updated every second</p>
            </div>
            <InterestInfo />
          </div>
        </section>

        <Features />

        <section id="transactions" className="py-20 bg-white dark:bg-slate-900 relative overflow-hidden transition-colors duration-300">
          <div className="absolute top-0 right-0 w-full h-full bg-gradient-radial from-icp-purple/5 dark:from-icp-darkPurple/10 to-transparent opacity-70 -z-10"></div>
          <div className="container mx-auto px-4">
            <div className="text-center mb-16">
              <h2 className="text-3xl md:text-4xl font-bold mb-4 bg-clip-text text-transparent bg-gradient-to-r from-icp-blue to-icp-teal dark:from-white dark:to-icp-darkTeal drop-shadow-sm">Start Your Transaction</h2>
              <p className="text-xl text-slate-600 dark:text-slate-200 max-w-2xl mx-auto">Top up or withdraw from your ICP wallet in just a few clicks</p>
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
