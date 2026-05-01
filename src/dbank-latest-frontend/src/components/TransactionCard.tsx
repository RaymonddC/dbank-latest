import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Upload, Download, ArrowRight, Lock } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import WalletButton from './WalletButton';

const FALLBACK_FEES = { networkFee: 0.0005, withdrawalFee: 0.001 };

type TxType = 'top-up' | 'withdrawal';

const TransactionCard = () => {
  const { actor: dbank, isAuthenticated, isReady, principal } = useAuth();

  const [balance, setBalance] = useState<number>(0);
  const [amount, setAmount] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<string>('topup');

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
  const networkFee = Number(fees.networkFee);
  const withdrawalFee = Number(fees.withdrawalFee);

  useEffect(() => {
    if (!dbank || !isAuthenticated) {
      setBalance(0);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        await dbank.compound();
        const currentBalance = Number(await dbank.checkBalance());
        if (cancelled) return;
        setBalance(Math.round(currentBalance * 100) / 100);
      } catch (error) {
        if (cancelled) return;
        toast.error('Could not fetch balance', { description: errorMessage(error) });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [dbank, isAuthenticated]);

  const handleSubmit = async (e: React.FormEvent, type: TxType) => {
    e.preventDefault();
    if (!dbank) return;
    const parsedAmount = parseFloat(amount);

    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      toast.error('Enter a positive amount');
      return;
    }
    if (type === 'top-up' && parsedAmount <= networkFee) {
      toast.error(`Amount must be greater than the network fee (${networkFee} ICP)`);
      return;
    }
    if (type === 'withdrawal' && parsedAmount + withdrawalFee > balance) {
      toast.error('Insufficient funds (including withdrawal fee)');
      return;
    }

    setLoading(true);
    try {
      if (type === 'top-up') {
        await dbank.topUp(parsedAmount);
      } else {
        await dbank.withdraw(parsedAmount);
      }
      await dbank.compound();
      const updatedBalance = Number(await dbank.checkBalance());
      setBalance(Math.round(updatedBalance * 100) / 100);
      setAmount('');
      toast.success(type === 'top-up' ? `Topped up ${parsedAmount} ICP` : `Withdrew ${parsedAmount} ICP`);
    } catch (error) {
      toast.error(`${type === 'top-up' ? 'Top-up' : 'Withdrawal'} failed`, { description: errorMessage(error) });
    } finally {
      setLoading(false);
    }
  };

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
    <Card className="max-w-md w-full mx-auto shadow-xl border-slate-200 dark:border-slate-700/50 glass-card overflow-hidden">
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
                  <span>Network Fee: {networkFee} ICP</span>
                  <span>Balance: {balance.toFixed(2)} ICP</span>
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
                  <span>Withdrawal Fee: {withdrawalFee} ICP</span>
                  <span>Available: {balance.toFixed(2)} ICP</span>
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
  );
};

function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}

export default TransactionCard;
