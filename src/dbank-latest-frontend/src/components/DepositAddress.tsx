import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Check, Copy, Wallet } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/contexts/AuthContext';
import { encodeIcrc1Account } from '@/lib/icrc1';

interface RawDepositAccount {
  owner: import('@icp-sdk/core/principal').Principal;
  subaccount: [Uint8Array] | [];
}

const DepositAddress = () => {
  const { actor: dbank, isAuthenticated, principal } = useAuth();
  const [copied, setCopied] = useState(false);

  const accountQuery = useQuery({
    queryKey: ['depositAccount', principal?.toText() ?? 'anonymous'],
    queryFn: async () => {
      if (!dbank) throw new Error('No actor');
      const raw = (await dbank.getDepositAccount()) as unknown as RawDepositAccount;
      // Candid maps `?Subaccount` to `[Uint8Array] | []`. Unwrap it.
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

  return (
    <Card>
      <CardHeader className="space-y-1.5 flex-row items-start gap-3">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-secondary text-foreground">
          <Wallet className="h-4 w-4" aria-hidden />
        </div>
        <div className="flex-1">
          <CardTitle className="font-serif text-lg">Your deposit address</CardTitle>
          <CardDescription>
            Send ICP to this account from any ICRC-1 capable wallet. Funds become available after you click <em>Notify deposit</em> (next PR).
          </CardDescription>
        </div>
      </CardHeader>
      <CardContent>
        {accountQuery.isLoading ? (
          <Skeleton className="h-10 w-full" />
        ) : accountQuery.error ? (
          <p className="text-sm text-destructive">Could not fetch your deposit address.</p>
        ) : (
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
        )}
      </CardContent>
    </Card>
  );
};

export default DepositAddress;
