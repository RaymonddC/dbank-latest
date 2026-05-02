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
import { useLiveBalance } from '@/hooks/useLiveBalance';
import { icpToE8s, e8sToIcp, formatIcp } from '@/lib/icp';
import { describeTransferError, errorMessage } from '@/lib/transferErrors';
import WalletButton from './WalletButton';
import TransactionHistory from './TransactionHistory';
import DepositAddress from './DepositAddress';

const FALLBACK_FEES = { networkFee: 50_000n, withdrawalFee: 100_000n };

type TxType = 'top-up' | 'withdrawal';

const TransactionCard = () => {
  const { actor: dbank, isAuthenticated, isReady, principal } = useAuth();
  const queryClient = useQueryClient();

  const [balance, setBalance] = useState<bigint>(0n);
  const [balanceAnchor, setBalanceAnchor] = useState<number>(Date.now());
  const [balanceLoaded, setBalanceLoaded] = useState<boolean>(false);
  const [amount, setAmount] = useState<string>('');
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
  const withdrawalFeeIcp = e8sToIcp(fees.withdrawalFee);

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

  const handleSubmit = async (e: React.FormEvent, type: TxType) => {
    e.preventDefault();
    if (!dbank) return;
    const parsedAmount = parseFloat(amount);

    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      toast.error('Enter a positive amount');
      return;
    }

    let amountE8s: bigint;
    try {
      amountE8s = icpToE8s(parsedAmount);
    } catch (err) {
      toast.error(errorMessage(err));
      return;
    }

    const optimistic =
      type === 'top-up'
        ? balance + amountE8s - fees.networkFee
        : balance - amountE8s - fees.withdrawalFee;
    const previousBalance = balance;
    const previousAnchor = balanceAnchor;
    setBalance(optimistic < 0n ? 0n : optimistic);
    setBalanceAnchor(Date.now());

    setLoading(true);
    try {
      const result =
        type === 'top-up'
          ? await dbank.topUp(amountE8s)
          : await dbank.withdraw(amountE8s);

      if ('err' in result) {
        setBalance(previousBalance);
        setBalanceAnchor(previousAnchor);
        toast.error(`${type === 'top-up' ? 'Top-up' : 'Withdrawal'} failed`, {
          description: describeTransferError(result.err),
        });
        return;
      }
      toast.success(`${type === 'top-up' ? 'Topped up' : 'Withdrew'} ${parsedAmount} ICP`);
      setAmount('');
      setRefreshTick((t) => t + 1);
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
    } catch (error) {
      setBalance(previousBalance);
      setBalanceAnchor(previousAnchor);
      toast.error(`${type === 'top-up' ? 'Top-up' : 'Withdrawal'} failed`, { description: errorMessage(error) });
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
            Connect with Internet Identity to top up, withdraw, and earn 1% daily compounding interest on your balance.
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
              <form onSubmit={(e) => handleSubmit(e, 'top-up')} aria-busy={loading}>
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
                        value={amount}
                        onChange={(e) => setAmount(e.target.value)}
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
              <CardTitle className="font-serif text-xl">Withdraw to your account</CardTitle>
              <CardDescription>Transfer ICP from your on-chain wallet.</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={(e) => handleSubmit(e, 'withdrawal')} aria-busy={loading}>
                <div className="grid gap-4">
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
                        value={amount}
                        onChange={(e) => setAmount(e.target.value)}
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
                      <dt className="sr-only">Withdrawal fee</dt>
                      <dd>Withdrawal fee {withdrawalFeeIcp} ICP</dd>
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
          Signed by Internet Identity. All transfers are on-chain.
        </CardFooter>
      </Card>

      <DepositAddress />
      <TransactionHistory />
    </div>
  );
};

export default TransactionCard;
