import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Upload, Download, ArrowRight, Lock } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useLimits } from '@/hooks/useLimits';
import { useLiveBalance } from '@/hooks/useLiveBalance';
import { icpToE8s, e8sToIcp, formatIcp } from '@/lib/icp';
import { decodeIcrc1Account } from '@/lib/icrc1';
import { describeTransferError, errorMessage } from '@/lib/transferErrors';
import WalletButton from './WalletButton';
import TransactionHistory from './TransactionHistory';
import DepositAddress from './DepositAddress';

const FALLBACK_FEES = { networkFee: 50_000n, withdrawalFee: 100_000n };

const TransactionCard = () => {
  const { actor: dbank, isAuthenticated, isReady, principal } = useAuth();
  const { accrueInterest } = useLimits();
  const queryClient = useQueryClient();

  const [balance, setBalance] = useState<bigint>(0n);
  const [balanceAnchor, setBalanceAnchor] = useState<number>(Date.now());
  const [balanceLoaded, setBalanceLoaded] = useState<boolean>(false);
  const [topupAmount, setTopupAmount] = useState<string>('');
  const [withdrawAmount, setWithdrawAmount] = useState<string>('');
  const [destination, setDestination] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [refreshTick, setRefreshTick] = useState(0);

  const liveBalance = useLiveBalance(balance, balanceAnchor);

  const feesQuery = useQuery({
    queryKey: ['fees', principal?.toText() ?? 'anonymous'],
    queryFn: async () => {
      if (!dbank) throw new Error('No actor');
      return await dbank.getFees();
    },
    enabled: !!dbank,
    staleTime: Infinity,
  });

  const fees = feesQuery.data ?? FALLBACK_FEES;
  const networkFeeIcp = e8sToIcp(fees.networkFee);

  useEffect(() => {
    if (!dbank || !isAuthenticated) {
      setBalance(0n);
      setBalanceLoaded(false);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        await dbank.compound();
        const current = await dbank.checkBalance();
        if (cancelled) return;
        setBalance(current);
        setBalanceAnchor(Date.now());
        setBalanceLoaded(true);
      } catch (error) {
        if (cancelled) return;
        toast.error('Could not fetch balance', { description: errorMessage(error) });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [dbank, isAuthenticated, refreshTick]);

  const handleTopUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!dbank) return;
    const parsed = parseFloat(topupAmount);
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

    const previousBalance = balance;
    const previousAnchor = balanceAnchor;
    setBalance(balance + amountE8s - fees.networkFee);
    setBalanceAnchor(Date.now());

    setLoading(true);
    try {
      const result = await dbank.topUp(amountE8s);
      if ('err' in result) {
        setBalance(previousBalance);
        setBalanceAnchor(previousAnchor);
        toast.error('Top-up failed', { description: describeTransferError(result.err) });
        return;
      }
      toast.success(`Topped up ${parsed} ICP`);
      setTopupAmount('');
      setRefreshTick((t) => t + 1);
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
    } catch (error) {
      setBalance(previousBalance);
      setBalanceAnchor(previousAnchor);
      toast.error('Top-up failed', { description: errorMessage(error) });
    } finally {
      setLoading(false);
    }
  };

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

    const previousBalance = balance;
    const previousAnchor = balanceAnchor;
    // Optimistic deduction (uses an estimate of the ledger fee — actual fee
    // returned from the backend may differ marginally).
    const optimisticDeduction = amountE8s + 10_000n;
    setBalance(balance >= optimisticDeduction ? balance - optimisticDeduction : 0n);
    setBalanceAnchor(Date.now());

    setLoading(true);
    try {
      const result = await dbank.withdraw(amountE8s, dest);
      if ('err' in result) {
        setBalance(previousBalance);
        setBalanceAnchor(previousAnchor);
        toast.error('Withdrawal failed', { description: describeTransferError(result.err) });
        return;
      }
      toast.success(`Withdrew ${parsed} ICP`, {
        description: `Ledger block index ${result.ok.toString()}`,
      });
      setWithdrawAmount('');
      setDestination('');
      setRefreshTick((t) => t + 1);
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
    } catch (error) {
      setBalance(previousBalance);
      setBalanceAnchor(previousAnchor);
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
            {accrueInterest
              ? 'Connect with Internet Identity to deposit, withdraw, and earn 1% daily compounding interest on your balance.'
              : 'Connect with Internet Identity to deposit ICP to your custody address and withdraw to any ICRC-1 account.'}
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
      <Card className="overflow-hidden">
        <Tabs defaultValue="topup" className="w-full">
          <TabsList aria-label="Transaction type" className="grid w-full grid-cols-2 rounded-none border-b border-border bg-transparent p-0 h-auto">
            <TabsTrigger
              value="topup"
              className="rounded-none border-b-2 border-transparent py-3.5 font-medium text-muted-foreground data-[state=active]:border-foreground data-[state=active]:bg-transparent data-[state=active]:text-foreground data-[state=active]:shadow-none"
            >
              <Upload className="mr-2 h-4 w-4" aria-hidden />
              Top Up
            </TabsTrigger>
            <TabsTrigger
              value="withdraw"
              className="rounded-none border-b-2 border-transparent py-3.5 font-medium text-muted-foreground data-[state=active]:border-foreground data-[state=active]:bg-transparent data-[state=active]:text-foreground data-[state=active]:shadow-none"
            >
              <Download className="mr-2 h-4 w-4" aria-hidden />
              Withdraw
            </TabsTrigger>
          </TabsList>

          <TabsContent value="topup" className="m-0">
            <CardHeader className="space-y-2">
              <CardTitle className="font-serif text-xl">Top up your wallet</CardTitle>
              <CardDescription>Add ICP to start earning compound interest immediately.</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleTopUp} aria-busy={loading}>
                <div className="grid gap-4">
                  <div className="grid gap-2">
                    <label htmlFor="topup-amount" className="text-sm font-medium text-foreground">
                      Amount
                    </label>
                    <div className="relative">
                      <Input
                        id="topup-amount"
                        placeholder="0.00"
                        type="number"
                        inputMode="decimal"
                        value={topupAmount}
                        onChange={(e) => setTopupAmount(e.target.value)}
                        className="pr-12"
                        step="0.001"
                        min="0"
                        required
                        disabled={loading}
                        aria-describedby="topup-fees"
                      />
                      <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-xs font-medium text-muted-foreground">
                        ICP
                      </span>
                    </div>
                  </div>
                  <dl id="topup-fees" className="flex justify-between text-xs text-muted-foreground">
                    <div>
                      <dt className="sr-only">Network fee</dt>
                      <dd>Network fee {networkFeeIcp} ICP</dd>
                    </div>
                    <div>
                      <dt className="sr-only">Current balance</dt>
                      <dd>Balance {balanceLabel}</dd>
                    </div>
                  </dl>
                </div>
                <Button className="w-full mt-6 group" type="submit" disabled={loading}>
                  {loading ? 'Processing…' : (
                    <>
                      Top Up
                      <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-0.5" aria-hidden />
                    </>
                  )}
                </Button>
              </form>
            </CardContent>
          </TabsContent>

          <TabsContent value="withdraw" className="m-0">
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
          </TabsContent>
        </Tabs>
        <CardFooter className="border-t border-border px-6 py-4 text-xs text-muted-foreground">
          Signed by Internet Identity. Withdrawals settle on the ICP ledger.
        </CardFooter>
      </Card>

      <DepositAddress />
      <TransactionHistory />
    </div>
  );
};

export default TransactionCard;
