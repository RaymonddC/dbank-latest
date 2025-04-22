import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Upload, Download, ArrowRight } from 'lucide-react';
import { dbank_latest_backend as dbank } from '../../../declarations/dbank-latest-backend';

const TransactionCard = () => {
  const networkFee = Number(import.meta.env.VITE_NETWORK_FEE) || 0.0005;
  const withdrawalFee = Number(import.meta.env.VITE_WITHDRAWAL_FEE) || 0.001;

  const [balance, setBalance] = useState<number>(0);
  const [amount, setAmount] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<string>('topup');

  useEffect(() => {
    const fetchBalance = async (): Promise<void> => {
      try {
        await dbank.compound();
        const currentBalance: number = await dbank.checkBalance();
        setBalance(Math.round(currentBalance * 100) / 100);
      } catch (error) {
        console.error('Error fetching balance:', error);
      }
    };

    fetchBalance();
  }, []);

  const handleSubmit = async (e: React.FormEvent, type: string) => {
    e.preventDefault();
    const parsedAmount: number = parseFloat(amount);

    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      console.error('Invalid amount. Please enter a positive number.');
      return;
    }

    // Validate amount with fees
    if (type === 'withdrawal' && parsedAmount + withdrawalFee > balance) {
      console.error('Insufficient funds including fee');
      return;
    }

    setLoading(true);
    try {
      if (type === 'top-up') {
        if (parsedAmount <= networkFee) {
          console.error('Amount must be greater than network fee');
          return;
        }
        await dbank.topUp(parsedAmount);
      } else {
        await dbank.withdraw(parsedAmount);
      }

      await dbank.compound();
      const updatedBalance: number = await dbank.checkBalance();
      setBalance(Math.round(updatedBalance * 100) / 100);
      setAmount('');
    } catch (error) {
      console.error(`Error processing ${type}:`, error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="max-w-md w-full mx-auto shadow-xl border-slate-200 dark:border-slate-700/50 glass-card overflow-hidden">
      <Tabs defaultValue="topup" className="w-full" onValueChange={setActiveTab}>
        <TabsList className="relative grid w-full grid-cols-2 p-0 rounded-none overflow-hidden bg-icp-blue">
          <div
            className="absolute inset-0 bg-icp-teal transition-transform duration-500 linear"
            style={{
              width: '50%',
              transform: activeTab === 'withdraw' ? 'translateX(100%)' : 'translateX(0)',
            }}
          />
          <TabsTrigger value="topup" className="relative py-3 text-white font-medium data-[state=active]:bg-transparent">
            <Upload className="mr-2 h-4 w-4" />
            Top Up
          </TabsTrigger>
          <TabsTrigger value="withdraw" className="relative py-3 text-white font-medium data-[state=active]:bg-transparent">
            <Download className="mr-2 h-4 w-4" />
            Withdraw
          </TabsTrigger>
        </TabsList>

        <TabsContent value="topup" className="opacity-100 transition-opacity duration-300 data-[state=inactive]:opacity-0">
          <CardHeader>
            <CardTitle>Top Up Your ICP Wallet</CardTitle>
            <CardDescription>Add funds to your Internet Computer wallet quickly and securely.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={(e) => handleSubmit(e, 'top-up')}>
              <div className="grid gap-4">
                <div className="grid gap-2">
                  <label htmlFor="amount" className="text-sm font-medium dark:text-slate-200">
                    Amount (ICP)
                  </label>
                  <Input
                    id="amount"
                    placeholder="Enter amount"
                    type="number"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="border-slate-300 dark:border-slate-700 dark:bg-slate-800/70 transition-all duration-200"
                    step="0.001"
                    min="0"
                    required
                    disabled={loading}
                  />
                </div>
                <div className="flex justify-between text-sm text-slate-500 dark:text-slate-400">
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
                  'Processing...'
                ) : (
                  <>
                    Continue to Payment <ArrowRight className="ml-2 h-4 w-4 transition-transform duration-200 group-hover:translate-x-1" />
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
            <form onSubmit={(e) => handleSubmit(e, 'withdrawal')}>
              <div className="grid gap-4">
                <div className="grid gap-2">
                  <label htmlFor="withdrawal-amount" className="text-sm font-medium dark:text-slate-200">
                    Amount (ICP)
                  </label>
                  <Input
                    id="withdrawal-amount"
                    placeholder="Enter amount"
                    type="number"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="border-slate-300 dark:border-slate-700 dark:bg-slate-800/70 transition-all duration-200"
                    step="0.001"
                    min="0"
                    required
                    disabled={loading}
                  />
                </div>
                <div className="flex justify-between text-sm text-slate-500 dark:text-slate-400">
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
                  'Processing...'
                ) : (
                  <>
                    Withdraw Funds <ArrowRight className="ml-2 h-4 w-4 transition-transform duration-200 group-hover:translate-x-1" />
                  </>
                )}
              </Button>
            </form>
          </CardContent>
        </TabsContent>
      </Tabs>
      <CardFooter className="flex justify-center p-6 border-t border-slate-200 dark:border-slate-700/50 text-sm text-slate-500 dark:text-slate-400">All transactions are encrypted and secure</CardFooter>
    </Card>
  );
};

export default TransactionCard;
