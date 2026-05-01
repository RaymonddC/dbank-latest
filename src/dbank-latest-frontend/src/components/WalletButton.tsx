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

  const sharedClasses =
    'relative bg-gradient-to-r from-icp-blue via-icp-teal to-icp-blue bg-[size:200%_100%] bg-right-bottom hover:bg-left-bottom text-white font-medium shadow-md hover:shadow-lg transition-[background-position] duration-500 ease-in-out';
  const widthClass = fullWidth ? 'w-full' : '';

  if (!isReady) {
    return (
      <Button className={`${widthClass} ${sharedClasses}`} disabled>
        Loading…
      </Button>
    );
  }

  if (!isAuthenticated || !principal) {
    return (
      <Button
        className={`${widthClass} ${sharedClasses} group`}
        onClick={async () => {
          await login();
          onAction?.();
        }}
      >
        Connect Wallet
        <ArrowRight className="ml-2 h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
      </Button>
    );
  }

  const principalText = principal.toText();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button className={`${widthClass} ${sharedClasses}`}>
          {truncate(principalText)}
          <ChevronDown className="ml-2 h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel className="font-normal">
          <div className="flex flex-col">
            <span className="text-xs text-slate-500 dark:text-slate-400">Signed in as</span>
            <span className="break-all text-xs font-mono">{principalText}</span>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          className="cursor-pointer"
          onClick={async () => {
            await logout();
            onAction?.();
          }}
        >
          <LogOut className="mr-2 h-4 w-4" />
          Disconnect
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default WalletButton;
