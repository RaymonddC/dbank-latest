import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ArrowRight, ChevronDown, LogOut } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

const truncate = (text: string, lead = 5, tail = 4) =>
  text.length <= lead + tail + 1 ? text : `${text.slice(0, lead)}…${text.slice(-tail)}`;

interface WalletButtonProps {
  fullWidth?: boolean;
  onAction?: () => void;
}

const WalletButton = ({ fullWidth = false, onAction }: WalletButtonProps) => {
  const { isAuthenticated, isReady, principal, login, logout } = useAuth();
  const [busy, setBusy] = useState(false);

  const widthClass = fullWidth ? 'w-full' : '';

  const handleLogin = async () => {
    setBusy(true);
    try {
      await login();
      onAction?.();
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (message && !/cancel|abort|closed/i.test(message)) {
        toast.error('Sign-in failed', { description: message });
      }
    } finally {
      setBusy(false);
    }
  };

  const handleLogout = async () => {
    setBusy(true);
    try {
      await logout();
      onAction?.();
    } catch (err) {
      toast.error('Sign-out failed', { description: err instanceof Error ? err.message : String(err) });
    } finally {
      setBusy(false);
    }
  };

  if (!isReady) {
    return (
      <Button className={widthClass} disabled aria-busy>
        Loading…
      </Button>
    );
  }

  if (!isAuthenticated || !principal) {
    return (
      <Button
        className={`${widthClass} group`}
        onClick={handleLogin}
        disabled={busy}
        aria-label="Connect with Internet Identity"
      >
        {busy ? 'Connecting…' : 'Connect Wallet'}
        <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-0.5" aria-hidden />
      </Button>
    );
  }

  const principalText = principal.toText();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          className={`${widthClass} font-mono text-sm`}
          aria-label={`Wallet menu for ${principalText}`}
          disabled={busy}
        >
          <span className="h-2 w-2 rounded-full bg-emerald-500 mr-2" aria-hidden />
          {truncate(principalText)}
          <ChevronDown className="ml-2 h-4 w-4 opacity-60" aria-hidden />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-72">
        <DropdownMenuLabel className="font-normal">
          <div className="flex flex-col gap-1">
            <span className="text-xs uppercase tracking-wide text-muted-foreground">Signed in as</span>
            <span className="break-all text-xs font-mono text-foreground">{principalText}</span>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem className="cursor-pointer" onClick={handleLogout} disabled={busy}>
          <LogOut className="mr-2 h-4 w-4" aria-hidden />
          Disconnect
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default WalletButton;
