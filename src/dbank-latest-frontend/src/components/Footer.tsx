import { Wallet, Twitter, Facebook, Instagram, Github } from "lucide-react";

const Footer = () => {
  const currentYear = new Date().getFullYear();
  
  return (
    <footer className="bg-slate-900 dark:bg-slate-950 text-white py-16 transition-colors duration-300">
      <div className="container mx-auto px-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-12">
          <div className="md:col-span-1">
            <div className="flex items-center space-x-2 mb-4">
              <Wallet className="h-8 w-8 text-icp-teal dark:text-icp-darkTeal" />
              <span className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-icp-blue to-icp-teal dark:from-icp-teal dark:to-icp-blue transition-all duration-200">ICP Finance</span>
            </div>
            <p className="text-slate-400 mb-6">
              The most secure platform for ICP network transactions. Fast, reliable, and user-friendly.
            </p>
            <div className="flex space-x-4">
              <a href="#" className="text-slate-400 hover:text-white transition-colors duration-200">
                <Twitter className="h-5 w-5" />
              </a>
              <a href="#" className="text-slate-400 hover:text-white transition-colors duration-200">
                <Facebook className="h-5 w-5" />
              </a>
              <a href="#" className="text-slate-400 hover:text-white transition-colors duration-200">
                <Instagram className="h-5 w-5" />
              </a>
              <a href="#" className="text-slate-400 hover:text-white transition-colors duration-200">
                <Github className="h-5 w-5" />
              </a>
            </div>
          </div>
          
          <div>
            <h3 className="text-lg font-semibold mb-4">Product</h3>
            <ul className="space-y-3">
              <li><a href="#" className="text-slate-400 hover:text-white transition">Features</a></li>
              <li><a href="#" className="text-slate-400 hover:text-white transition">Security</a></li>
              <li><a href="#" className="text-slate-400 hover:text-white transition">Pricing</a></li>
              <li><a href="#" className="text-slate-400 hover:text-white transition">Roadmap</a></li>
            </ul>
          </div>
          
          <div>
            <h3 className="text-lg font-semibold mb-4">Resources</h3>
            <ul className="space-y-3">
              <li><a href="#" className="text-slate-400 hover:text-white transition">Documentation</a></li>
              <li><a href="#" className="text-slate-400 hover:text-white transition">API Reference</a></li>
              <li><a href="#" className="text-slate-400 hover:text-white transition">Tutorials</a></li>
              <li><a href="#" className="text-slate-400 hover:text-white transition">Blog</a></li>
            </ul>
          </div>
          
          <div>
            <h3 className="text-lg font-semibold mb-4">Company</h3>
            <ul className="space-y-3">
              <li><a href="#" className="text-slate-400 hover:text-white transition">About</a></li>
              <li><a href="#" className="text-slate-400 hover:text-white transition">Careers</a></li>
              <li><a href="#" className="text-slate-400 hover:text-white transition">Contact</a></li>
              <li><a href="#" className="text-slate-400 hover:text-white transition">Partners</a></li>
            </ul>
          </div>
        </div>
        
        <div className="mt-16 pt-8 border-t border-slate-800 flex flex-col md:flex-row justify-between items-center">
          <p className="text-slate-400 mb-4 md:mb-0">
            &copy; {currentYear} ICP Finance. All rights reserved.
          </p>
          <div className="flex space-x-6">
            <a href="#" className="text-slate-400 hover:text-white transition-colors duration-200">Privacy Policy</a>
            <a href="#" className="text-slate-400 hover:text-white transition-colors duration-200">Terms of Service</a>
            <a href="#" className="text-slate-400 hover:text-white transition-colors duration-200">Cookie Policy</a>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
