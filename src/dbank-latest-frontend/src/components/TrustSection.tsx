
import { Shield, Lock, CheckCircle, Award } from "lucide-react";

const TrustSection = () => {
  return (
    <section id="trust" className="py-20 dark:bg-slate-950 transition-colors duration-300">
      <div className="container mx-auto px-4">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4 dark:text-white">Your Security Is Our Priority</h2>
            <p className="text-xl text-slate-600 dark:text-slate-400">
              We employ multiple layers of protection to keep your assets and information safe.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="bg-white dark:bg-slate-800 rounded-2xl p-8 shadow-lg border border-slate-100 dark:border-slate-700/50 flex items-start space-x-4">
              <Shield className="h-8 w-8 text-icp-teal dark:text-icp-darkTeal flex-shrink-0 mt-1" />
              <div>
                <h3 className="text-xl font-semibold mb-3 dark:text-white">Advanced Encryption</h3>
                <p className="text-slate-600 dark:text-slate-400">
                  All sensitive data is encrypted with AES-256, the same encryption standard used by banks and military organizations worldwide.
                </p>
              </div>
            </div>
            
            <div className="bg-white dark:bg-slate-800 rounded-2xl p-8 shadow-lg border border-slate-100 dark:border-slate-700/50 flex items-start space-x-4">
              <Lock className="h-8 w-8 text-icp-teal dark:text-icp-darkTeal flex-shrink-0 mt-1" />
              <div>
                <h3 className="text-xl font-semibold mb-3 dark:text-white">Secure Authentication</h3>
                <p className="text-slate-600 dark:text-slate-400">
                  Multiple authentication factors ensure that only you can access your account, even if your password is compromised.
                </p>
              </div>
            </div>
            
            <div className="bg-white dark:bg-slate-800 rounded-2xl p-8 shadow-lg border border-slate-100 dark:border-slate-700/50 flex items-start space-x-4">
              <CheckCircle className="h-8 w-8 text-icp-teal dark:text-icp-darkTeal flex-shrink-0 mt-1" />
              <div>
                <h3 className="text-xl font-semibold mb-3 dark:text-white">Regular Security Audits</h3>
                <p className="text-slate-600 dark:text-slate-400">
                  Our platform undergoes regular security audits by independent third parties to identify and address potential vulnerabilities.
                </p>
              </div>
            </div>
            
            <div className="bg-white dark:bg-slate-800 rounded-2xl p-8 shadow-lg border border-slate-100 dark:border-slate-700/50 flex items-start space-x-4">
              <Award className="h-8 w-8 text-icp-teal dark:text-icp-darkTeal flex-shrink-0 mt-1" />
              <div>
                <h3 className="text-xl font-semibold mb-3 dark:text-white">Compliance Standards</h3>
                <p className="text-slate-600 dark:text-slate-400">
                  We adhere to international security standards and best practices to ensure your funds are always protected.
                </p>
              </div>
            </div>
          </div>

          <div className="mt-16 bg-icp-gradient dark:bg-icp-dark-gradient rounded-2xl p-8 shadow-lg text-white text-center">
            <h3 className="text-2xl font-bold mb-4">100% Secure Transactions</h3>
            <p className="text-lg opacity-90 mb-6">
              We've processed over 1 million transactions without a single security incident.
            </p>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <p className="text-3xl font-bold">$45M+</p>
                <p className="text-sm opacity-80">Processed</p>
              </div>
              <div>
                <p className="text-3xl font-bold">50,000+</p>
                <p className="text-sm opacity-80">Users</p>
              </div>
              <div>
                <p className="text-3xl font-bold">99.9%</p>
                <p className="text-sm opacity-80">Uptime</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default TrustSection;
