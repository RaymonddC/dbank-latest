
import { Shield, Zap, RefreshCw, Globe } from "lucide-react";

const features = [
  {
    icon: <Zap className="h-10 w-10 text-icp-teal dark:text-icp-darkTeal" />,
    title: "Instant Transactions",
    description: "Process top-ups and withdrawals within seconds, no waiting periods or delays."
  },
  {
    icon: <Shield className="h-10 w-10 text-icp-teal dark:text-icp-darkTeal" />,
    title: "Bank-Level Security",
    description: "Your assets are protected with state-of-the-art encryption and security protocols."
  },
  {
    icon: <RefreshCw className="h-10 w-10 text-icp-teal dark:text-icp-darkTeal" />,
    title: "Seamless Integration",
    description: "Easily connect with existing wallets and services in the ICP ecosystem."
  },
  {
    icon: <Globe className="h-10 w-10 text-icp-teal dark:text-icp-darkTeal" />,
    title: "Global Accessibility",
    description: "Access your funds from anywhere in the world, anytime you need them."
  }
];

const Features = () => {
  return (
    <section id="features" className="py-20 bg-slate-50 dark:bg-slate-900/50 transition-colors duration-300">
      <div className="container mx-auto px-4">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-bold mb-4 dark:text-white">Why Choose Our Platform</h2>
          <p className="text-xl text-slate-600 dark:text-slate-400 max-w-2xl mx-auto">
            We've built the most reliable way to interact with the Internet Computer Protocol
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          {features.map((feature, index) => (
            <div 
              key={index} 
              className="bg-white dark:bg-slate-800 rounded-2xl p-8 shadow-lg border border-slate-100 dark:border-slate-700/50 hover:shadow-xl transition duration-300 hover:-translate-y-1"
            >
              <div className="mb-6">{feature.icon}</div>
              <h3 className="text-xl font-semibold mb-3 dark:text-white">{feature.title}</h3>
              <p className="text-slate-600 dark:text-slate-400">{feature.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default Features;
