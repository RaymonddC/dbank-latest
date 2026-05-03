import { WifiOff } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

const ConnectionBanner = () => {
  const { connection } = useAuth();
  if (connection !== 'down') return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed top-0 left-0 right-0 z-[60] border-b border-destructive/30 bg-destructive/10 text-foreground backdrop-blur"
    >
      <div className="container mx-auto px-4 py-2 flex items-center justify-center gap-2 text-sm">
        <WifiOff className="h-4 w-4 text-destructive" aria-hidden />
        <span>Cannot reach the Internet Computer canister. Retrying…</span>
      </div>
    </div>
  );
};

export default ConnectionBanner;
