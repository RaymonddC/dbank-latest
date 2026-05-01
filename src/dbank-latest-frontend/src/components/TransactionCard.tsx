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
import WalletButton from './WalletButton';
import TransactionHistory from './TransactionHistory';

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
  const [activeTab, setActiveTab] = useState<string>('topup');
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

    // Optimistic update so the balance + button feedback feels instant.
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
        // Roll back optimistic state.
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
    <span className="font-mono">{formatIcp(liveBalance, 4)} ICP</span>
  ) : (
    <Skeleton className="inline-block h-4 w-20 align-middle" />
  );

  if (isReady && !isAuthenticated) {
    return (
      <Card className="max-w-md w-full mx-auto shadow-xl border-slate-200 dark:border-slate-700/50 glass-card">
        <CardHeader className="items-center text-center">
          <div className="bg-gradient-to-r from-icp-blue to-icp-teal p-3 rounded-full shadow-lg mb-2">
            <Lock className="h-6 w-6 text-white" aria-hidden />
          </div>
          <CardTitle>Sign in to manage your wallet</CardTitle>
          <CardDescription>
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
    <div className="max-w-md w-full mx-auto space-y-6">
      <Card className="shadow-xl border-slate-200 dark:border-slate-700/50 glass-card overflow-hidden">
        <Tabs defaultValue="topup" className="w-full" onValueChange={setActiveTab}>
          <TabsList aria-label="Transaction type" className="relative grid w-full grid-cols-2 p-0 rounded-none overflow-hidden bg-icp-blue">
            <div
              aria-hidden
              className="absolute inset-0 bg-icp-teal transition-transform duration-500 linear"
              style={{
                width: '50%',
                transform: activeTab === 'withdraw' ? 'translateX(100%)' : 'translateX(0)',
              }}
            />
            <TabsTrigger value="topup" className="relative py-3 text-white font-medium data-[state=active]:bg-transparent">
              <Upload className="mr-2 h-4 w-4" aria-hidden />
              Top Up
            </TabsTrigger>
            <TabsTrigger value="withdraw" className="relative py-3 text-white font-medium data-[state=active]:bg-transparent">
              <Download className="mr-2 h-4 w-4" aria-hidden />
              Withdraw
            </TabsTrigger>
          </TabsList>

          <TabsContent value="topup" className="opacity-100 transition-opacity duration-300 data-[state=inactive]:opacity-0">
            <CardHeader>
              <CardTitle>Top Up Your ICP Wallet</CardTitle>
              <CardDescription>Add funds to your Internet Computer wallet quickly and securely.</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={(e) => handleSubmit(e, 'top-up')} aria-busy={loading}>
                <div className="grid gap-4">
                  <div className="grid gap-2">
                    <label htmlFor="topup-amount" className="text-sm font-medium dark:text-slate-200">
                      Amount (ICP)
                    </label>
                    <Input
                      id="topup-amount"
                      placeholder="Enter amount"
                      type="number"
                      inputMode="decimal"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      className="border-slate-300 dark:border-slate-700 dark:bg-slate-800/70 transition-all duration-200"
                      step="0.001"
                      min="0"
                      required
                      disabled={loading}
                      aria-describedby="topup-fees"
                    />
                  </div>
                  <div id="topup-fees" className="flex justify-between text-sm text-slate-500 dark:text-slate-400">
                    <span>Network Fee: {networkFeeIcp} ICP</span>
                    <span>Balance: {balanceLabel}</span>
                  </div>
                </div>
                <Button
                  className="w-full mt-6 relative bg-gradient-to-r from-icp-blue via-icp-teal to-icp-blue bg-[size:200%_100%] bg-right-bottom hover:bg-left-bottom text-white font-medium shadow-md hover:shadow-lg transition-[background-position] duration-500 ease-in-out group"
                  type="submit"
                  disabled={loading}
                >
                  {loading ? (
                    'Processing…'
                  ) : (
                    <>
                      Top Up <ArrowRight className="ml-2 h-4 w-4 transition-transform duration-200 group-hover:translate-x-1" aria-hidden />
                    </>
                  )}
                </Button>
              </form>
            </CardContent>
          </TabsContent>

          <TabsContent value="withdraw" className="opacity-100 transition-opacity duration-300 data-[state=inactive]:opacity-0">
            <CardHeader>
              <CardTitle>Withdraw From Your ICP Wallet</CardTitle>
              <CardDescription>Transfer funds from your Internet Computer wallet to your bank account.</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={(e) => handleSubmit(e, 'withdrawal')} aria-busy={loading}>
                <div className="grid gap-4">
                  <div className="grid gap-2">
                    <label htmlFor="withdrawal-amount" className="text-sm font-medium dark:text-slate-200">
                      Amount (ICP)
                    </label>
                    <Input
                      id="withdrawal-amount"
                      placeholder="Enter amount"
                      type="number"
                      inputMode="decimal"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      className="border-slate-300 dark:border-slate-700 dark:bg-slate-800/70 transition-all duration-200"
                      step="0.001"
                      min="0"
                      required
                      disabled={loading}
                      aria-describedby="withdraw-fees"
                    />
                  </div>
                  <div id="withdraw-fees" className="flex justify-between text-sm text-slate-500 dark:text-slate-400">
                    <span>Withdrawal Fee: {withdrawalFeeIcp} ICP</span>
                    <span>Available: {balanceLabel}</span>
                  </div>
                </div>
                <Button
                  className="w-full mt-6 relative bg-gradient-to-r from-icp-blue via-icp-teal to-icp-blue bg-[size:200%_100%] bg-right-bottom hover:bg-left-bottom text-white font-medium shadow-md hover:shadow-lg transition-[background-position] duration-500 ease-in-out group"
                  type="submit"
                  disabled={loading}
                >
                  {loading ? (
                    'Processing…'
                  ) : (
                    <>
                      Withdraw <ArrowRight className="ml-2 h-4 w-4 transition-transform duration-200 group-hover:translate-x-1" aria-hidden />
                    </>
                  )}
                </Button>
              </form>
            </CardContent>
          </TabsContent>
        </Tabs>
        <CardFooter className="flex justify-center p-6 border-t border-slate-200 dark:border-slate-700/50 text-sm text-slate-500 dark:text-slate-400">
          All transactions are encrypted and secure
        </CardFooter>
      </Card>

      <TransactionHistory />
    </div>
  );
};

function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}

function describeTransferError(err: unknown): string {
  if (typeof err !== 'object' || err === null) return 'Transfer failed';
  if ('invalidAmount' in err) return 'Amount must be greater than zero';
  if ('belowFee' in err) {
    const fee = (err as { belowFee: { fee: bigint } }).belowFee.fee;
    return `Amount must be greater than the network fee (${e8sToIcp(fee)} ICP)`;
  }
  if ('insufficientFunds' in err) {
    const { balance, required } = (err as { insufficientFunds: { balance: bigint; required: bigint } }).insufficientFunds;
    return `Insufficient funds: balance ${e8sToIcp(balance)} ICP, required ${e8sToIcp(required)} ICP (incl. fee)`;
  }
  return 'Transfer failed';
}

export default TransactionCard;
