import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Check, Copy, RefreshCw, Wallet } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/contexts/AuthContext';
import { encodeIcrc1Account } from '@/lib/icrc1';
import { e8sToIcp } from '@/lib/icp';
import { errorMessage } from '@/lib/transferErrors';

interface RawDepositAccount {
  owner: import('@icp-sdk/core/principal').Principal;
  subaccount: [Uint8Array] | [];
}

const DepositAddress = () => {
  const { actor: dbank, isAuthenticated, principal } = useAuth();
  const queryClient = useQueryClient();
  const [copied, setCopied] = useState(false);
  const [notifying, setNotifying] = useState(false);

  const accountQuery = useQuery({
    queryKey: ['depositAccount', principal?.toText() ?? 'anonymous'],
    queryFn: async () => {
      if (!dbank) throw new Error('No actor');
      const raw = (await dbank.getDepositAccount()) as unknown as RawDepositAccount;
      const subaccount = raw.subaccount.length > 0 ? raw.subaccount[0] : null;
      return encodeIcrc1Account({ owner: raw.owner, subaccount });
    },
    enabled: !!dbank && isAuthenticated,
    staleTime: Infinity,
  });

  if (!isAuthenticated) return null;

  const handleCopy = async () => {
    if (!accountQuery.data) return;
    try {
      await navigator.clipboard.writeText(accountQuery.data);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard unavailable; ignore */
    }
  };

  const handleNotify = async () => {
    if (!dbank) return;
    setNotifying(true);
    try {
      const result = await dbank.notifyDeposit();
      if ('err' in result) {
        toast.error('Notify deposit failed', { description: describeNotifyError(result.err) });
        return;
      }
      const credited = result.ok;
      if (credited === 0n) {
        toast.message('No new deposits', {
          description: "We didn't see any new ICP at your deposit address yet.",
        });
      } else {
        toast.success(`Credited ${e8sToIcp(credited)} ICP to your wallet`);
        // Refresh balance + tx history.
        queryClient.invalidateQueries({ queryKey: ['transactions'] });
        queryClient.invalidateQueries({ queryKey: ['balance'] });
      }
    } catch (err) {
      toast.error('Notify deposit failed', { description: errorMessage(err) });
    } finally {
      setNotifying(false);
    }
  };

  return (
    <Card>
      <CardHeader className="space-y-1.5 flex-row items-start gap-3">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-secondary text-foreground">
          <Wallet className="h-4 w-4" aria-hidden />
        </div>
        <div className="flex-1">
          <CardTitle className="font-serif text-lg">Your deposit address</CardTitle>
          <CardDescription>
            Send ICP to this account from any ICRC-1 wallet, then click <em>Notify deposit</em> to credit it.
          </CardDescription>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {accountQuery.isLoading ? (
          <Skeleton className="h-10 w-full" />
        ) : accountQuery.error ? (
          <p className="text-sm text-destructive">Could not fetch your deposit address.</p>
        ) : (
          <>
            <div className="flex items-stretch gap-2">
              <code className="flex-1 select-all rounded-md border border-border bg-secondary/40 px-3 py-2 font-mono text-xs break-all">
                {accountQuery.data}
              </code>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleCopy}
                aria-label="Copy deposit address to clipboard"
                className="shrink-0"
              >
                {copied ? <Check className="h-3.5 w-3.5" aria-hidden /> : <Copy className="h-3.5 w-3.5" aria-hidden />}
                <span className="sr-only sm:not-sr-only sm:ml-1.5">{copied ? 'Copied' : 'Copy'}</span>
              </Button>
            </div>

            <Button
              type="button"
              onClick={handleNotify}
              disabled={notifying}
              className="w-full"
            >
              <RefreshCw
                className={`mr-2 h-4 w-4 ${notifying ? 'animate-spin' : ''}`}
                aria-hidden
              />
              {notifying ? 'Checking ledger…' : 'Notify deposit'}
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
};

function describeNotifyError(err: unknown): string {
  if (typeof err !== 'object' || err === null) return 'Notify failed';
  if ('rateLimited' in err) {
    const wait = Number((err as { rateLimited: { retryAfterNs: bigint } }).rateLimited.retryAfterNs) / 1_000_000;
    return `Slow down — try again in ${Math.max(1, Math.round(wait))} ms`;
  }
  if ('ledgerUnreachable' in err) {
    const m = (err as { ledgerUnreachable: { message: string } }).ledgerUnreachable.message;
    return `Ledger unreachable: ${m}`;
  }
  return 'Notify failed';
}

export default DepositAddress;
