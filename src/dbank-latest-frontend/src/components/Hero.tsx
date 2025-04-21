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
    <section className="relative pt-32 pb-20 md:pt-40 md:pb-28 overflow-hidden">
      {/* Background Elements */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden -z-10">
        <div className="absolute top-0 right-0 w-1/2 h-1/2 bg-gradient-radial from-icp-teal/10 to-transparent opacity-70"></div>
        <div className="absolute bottom-0 left-0 w-1/3 h-1/3 bg-gradient-radial from-icp-purple/10 to-transparent opacity-70"></div>
      </div>

      <div className="container mx-auto px-4">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="text-4xl md:text-6xl font-bold mb-6">
            Secure <span className="text-gradient drop-shadow-sm">ICP Network</span> Transactions Made Simple
          </h1>
          <p className="text-xl text-slate-600 dark:text-slate-300 mb-10 max-w-2xl mx-auto">The most elegant way to top up and withdraw from the Internet Computer Protocol network. Fast, secure, and designed for you.</p>
          <div className="flex flex-col sm:flex-row justify-center gap-4">
            <Button
              className="relative bg-gradient-to-r from-icp-blue via-icp-teal to-icp-blue bg-[size:200%_100%] bg-right-bottom hover:bg-left-bottom text-white font-medium shadow-md hover:shadow-lg transition-[background-position] duration-500 ease-in-out px-8 py-6 text-lg group"
              onClick={scrollToTransactions}
            >
              Get Started <ArrowRight className="ml-2 h-5 w-5 transition-transform duration-300 group-hover:translate-x-1" />
            </Button>
            <Button
              variant="outline"
              className="border-2 border-slate-300 dark:border-slate-600 text-slate-700 dark:text-white hover:bg-slate-100 dark:hover:bg-slate-800 px-8 py-6 text-lg font-medium shadow-md hover:shadow-xl transition-all duration-300 ease-in-out"
            >
              Learn More
            </Button>
          </div>
          <div className="mt-20 animate-bounce">
            <a href="#features" className="inline-flex items-center justify-center">
              <ChevronDown className="h-8 w-8 text-slate-400 dark:text-slate-300" />
            </a>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Hero;
