import { useEffect, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { ArrowRight, Lock } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useLiveBalance } from '@/hooks/useLiveBalance';
import { icpToE8s, formatIcp } from '@/lib/icp';
import { decodeIcrc1Account } from '@/lib/icrc1';
import { describeTransferError, errorMessage } from '@/lib/transferErrors';
import WalletButton from './WalletButton';
import TransactionHistory from './TransactionHistory';
import DepositAddress from './DepositAddress';

const TransactionCard = () => {
  const { actor: dbank, isAuthenticated, isReady, principal } = useAuth();
  const queryClient = useQueryClient();

  const [withdrawAmount, setWithdrawAmount] = useState<string>('');
  const [destination, setDestination] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  // Optimistic overrides for the live-ticking display. When set, they take
  // precedence over the server balance until the next successful refetch.
  const [optimisticBalance, setOptimisticBalance] = useState<bigint | null>(null);
  const [optimisticAnchor, setOptimisticAnchor] = useState<number>(Date.now());

  // M2: balance is a TanStack query so DepositAddress and handleWithdraw can
  // both invalidate it via queryClient.invalidateQueries(['balance']).
  const balanceQuery = useQuery({
    queryKey: ['balance', principal?.toText() ?? 'anonymous'],
    queryFn: async () => {
      if (!dbank) throw new Error('No actor');
      await dbank.compound();
      return await dbank.checkBalance();
    },
    enabled: !!dbank && isAuthenticated,
    refetchOnWindowFocus: false,
  });

  // When new server data lands, drop any optimistic override.
  useEffect(() => {
    if (balanceQuery.data !== undefined) {
      setOptimisticBalance(null);
      setOptimisticAnchor(Date.now());
    }
  }, [balanceQuery.data, balanceQuery.dataUpdatedAt]);

  const baseBalance: bigint = optimisticBalance ?? balanceQuery.data ?? 0n;
  const baseAnchor: number = optimisticBalance !== null ? optimisticAnchor : balanceQuery.dataUpdatedAt || Date.now();
  const liveBalance = useLiveBalance(baseBalance, baseAnchor);
  const balanceLoaded = balanceQuery.isSuccess || optimisticBalance !== null;

  const refetchBalance = useMemo(
    () => () => queryClient.invalidateQueries({ queryKey: ['balance'] }),
    [queryClient],
  );

  const handleWithdraw = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!dbank) return;

    const parsed = parseFloat(withdrawAmount);
    if (isNaN(parsed) || parsed <= 0) {
      toast.error('Enter a positive amount');
      return;
    }

    let amountE8s: bigint;
    try {
      amountE8s = icpToE8s(parsed);
    } catch (err) {
      toast.error(errorMessage(err));
      return;
    }

    let dest;
    try {
      const parsedAcc = decodeIcrc1Account(destination.trim());
      dest = {
        owner: parsedAcc.owner,
        subaccount: parsedAcc.subaccount ? ([parsedAcc.subaccount] as [Uint8Array]) : ([] as []),
      };
    } catch (err) {
      toast.error('Invalid destination address', { description: errorMessage(err) });
      return;
    }

    const previousOptimistic = optimisticBalance;
    // Optimistic deduction (uses an estimate of the ledger fee — actual fee
    // returned from the backend may differ marginally).
    const optimisticDeduction = amountE8s + 10_000n;
    setOptimisticBalance(baseBalance >= optimisticDeduction ? baseBalance - optimisticDeduction : 0n);
    setOptimisticAnchor(Date.now());

    setLoading(true);
    try {
      const result = await dbank.withdraw(amountE8s, dest);
      if ('err' in result) {
        setOptimisticBalance(previousOptimistic);
        toast.error('Withdrawal failed', { description: describeTransferError(result.err) });
        return;
      }
      toast.success(`Withdrew ${parsed} ICP`, {
        description: `Ledger block index ${result.ok.toString()}`,
      });
      setWithdrawAmount('');
      setDestination('');
      refetchBalance();
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
    } catch (error) {
      setOptimisticBalance(previousOptimistic);
      toast.error('Withdrawal failed', { description: errorMessage(error) });
    } finally {
      setLoading(false);
    }
  };

  const balanceLabel = balanceLoaded ? (
    <span className="font-mono text-foreground">{formatIcp(liveBalance, 4)} ICP</span>
  ) : (
    <Skeleton className="inline-block h-4 w-24 align-middle" />
  );

  if (isReady && !isAuthenticated) {
    return (
      <Card className="max-w-md w-full mx-auto">
        <CardHeader className="items-center text-center space-y-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-full bg-secondary text-foreground">
            <Lock className="h-5 w-5" aria-hidden />
          </div>
          <CardTitle className="font-serif text-2xl">Sign in to manage your wallet</CardTitle>
          <CardDescription className="max-w-sm">
            Connect with Internet Identity to deposit ICP to your custody address and withdraw to any ICRC-1 account.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex justify-center pb-8">
          <WalletButton />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="max-w-md w-full mx-auto space-y-5">
      {/* Order: deposit address (the entry point) → withdraw form (the exit) →
          history. Custody mode is the only mode now that topUp is gone. */}
      <DepositAddress />

      <Card className="overflow-hidden">
        <CardHeader className="space-y-2">
          <CardTitle className="font-serif text-xl">Withdraw to an account</CardTitle>
          <CardDescription>Transfer ICP via the ledger to any ICRC-1 account.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleWithdraw} aria-busy={loading}>
            <div className="grid gap-4">
              <div className="grid gap-2">
                <label htmlFor="withdrawal-destination" className="text-sm font-medium text-foreground">
                  Destination (ICRC-1 account)
                </label>
                <Input
                  id="withdrawal-destination"
                  placeholder="aaaaa-aa or aaaaa-aa-xxxxxxxx.1"
                  type="text"
                  autoCapitalize="off"
                  autoCorrect="off"
                  spellCheck={false}
                  value={destination}
                  onChange={(e) => setDestination(e.target.value)}
                  className="font-mono text-xs"
                  required
                  disabled={loading}
                />
              </div>
              <div className="grid gap-2">
                <label htmlFor="withdrawal-amount" className="text-sm font-medium text-foreground">
                  Amount
                </label>
                <div className="relative">
                  <Input
                    id="withdrawal-amount"
                    placeholder="0.00"
                    type="number"
                    inputMode="decimal"
                    value={withdrawAmount}
                    onChange={(e) => setWithdrawAmount(e.target.value)}
                    className="pr-12"
                    step="0.001"
                    min="0"
                    required
                    disabled={loading}
                    aria-describedby="withdraw-fees"
                  />
                  <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-xs font-medium text-muted-foreground">
                    ICP
                  </span>
                </div>
              </div>
              <dl id="withdraw-fees" className="flex justify-between text-xs text-muted-foreground">
                <div>
                  <dt className="sr-only">Ledger fee</dt>
                  <dd>Ledger fee charged at submit</dd>
                </div>
                <div>
                  <dt className="sr-only">Available</dt>
                  <dd>Available {balanceLabel}</dd>
                </div>
              </dl>
            </div>
            <Button className="w-full mt-6 group" type="submit" disabled={loading}>
              {loading ? 'Processing…' : (
                <>
                  Withdraw
                  <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-0.5" aria-hidden />
                </>
              )}
            </Button>
          </form>
        </CardContent>
        <CardFooter className="border-t border-border px-6 py-4 text-xs text-muted-foreground">
          Signed by Internet Identity. Withdrawals settle on the ICP ledger.
        </CardFooter>
      </Card>

      <TransactionHistory />
    </div>
  );
};

export default TransactionCard;
