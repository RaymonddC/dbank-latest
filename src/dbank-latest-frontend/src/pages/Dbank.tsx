import React, { useState, useEffect, FormEvent } from 'react';
import { dbank_latest_backend as dbank } from '../../../declarations/dbank-latest-backend';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ArrowRight, Upload, Download } from 'lucide-react';

const Dbank: React.FC = () => {
  const [balance, setBalance] = useState<number>(0);
  const [topUpAmount, setTopUpAmount] = useState<string>('');
  const [withdrawAmount, setWithdrawAmount] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);

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

  const handleTopUp = async (e: FormEvent): Promise<void> => {
    e.preventDefault();
    const amount: number = parseFloat(topUpAmount);
    if (isNaN(amount) || amount <= 0) {
      console.error('Invalid top-up amount. Please enter a positive number.');
      return;
    }
    setLoading(true);
    try {
      await dbank.topUp(amount);
      const updatedBalance: number = await dbank.checkBalance();
      setBalance(Math.round(updatedBalance * 100) / 100);
      setTopUpAmount('');
    } catch (error) {
      console.error('Error topping up:', error);
    } finally {
      await dbank.compound();
      setLoading(false);
    }
  };

  const handleWithdraw = async (e: FormEvent): Promise<void> => {
    e.preventDefault();
    const amount: number = parseFloat(withdrawAmount);
    if (isNaN(amount) || amount <= 0) {
      console.error('Invalid withdrawal amount. Please enter a positive number.');
      return;
    }
    setLoading(true);
    try {
      await dbank.withdraw(amount);
      const updatedBalance: number = await dbank.checkBalance();
      setBalance(Math.round(updatedBalance * 100) / 100);
      setWithdrawAmount('');
    } catch (error) {
      console.error('Error withdrawing:', error);
    } finally {
      await dbank.compound();
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background font-sans antialiased">
      <div className="container mx-auto px-4 py-10">
        <div className="flex justify-center">
          <img src="dbank_logo.png" alt="DBank logo" className="h-16 w-16 mb-8" />
        </div>

        <Card className="glass-card max-w-md mx-auto">
          <Tabs defaultValue="topup" className="w-full">
            <TabsList className="w-full grid grid-cols-2">
              <TabsTrigger
                value="topup"
                className="rounded-none py-3 overflow-hidden transition-all duration-200
                  data-[state=active]:bg-gradient-to-r 
                  data-[state=active]:from-icp-blue data-[state=active]:to-icp-teal 
                  dark:data-[state=active]:from-icp-teal dark:data-[state=active]:to-icp-blue 
                  data-[state=active]:text-white data-[state=active]:font-medium"
              >
                <Upload className="mr-2 h-4 w-4" />
                Top Up
              </TabsTrigger>
              <TabsTrigger
                value="withdraw"
                className="rounded-none py-3 overflow-hidden transition-all duration-200
                  data-[state=active]:bg-gradient-to-r 
                  data-[state=active]:from-icp-blue data-[state=active]:to-icp-teal 
                  dark:data-[state=active]:from-icp-teal dark:data-[state=active]:to-icp-blue 
                  data-[state=active]:text-white data-[state=active]:font-medium"
              >
                <Download className="mr-2 h-4 w-4" />
                Withdraw
              </TabsTrigger>
            </TabsList>

            <CardHeader>
              <CardTitle className="text-2xl font-bold text-center mb-2 text-gradient">Current Balance</CardTitle>
              <CardDescription className="text-3xl font-bold text-center">${balance.toFixed(2)}</CardDescription>
            </CardHeader>

            <TabsContent value="topup">
              <CardContent>
                <form onSubmit={handleTopUp}>
                  <div className="grid gap-4">
                    <div className="grid gap-2">
                      <label className="text-sm font-medium dark:text-slate-200">Amount to Top Up</label>
                      <Input type="number" step="0.01" min="0" value={topUpAmount} onChange={(e) => setTopUpAmount(e.target.value)} className="border-slate-300 dark:border-slate-700 dark:bg-slate-800/70" placeholder="Enter amount" />
                    </div>
                    <div className="flex justify-between text-sm text-slate-500 dark:text-slate-400">
                      <span>Network Fee: 0.001 ICP</span>
                      <span>Balance: {balance.toFixed(2)} ICP</span>
                    </div>
                    <Button type="submit" disabled={loading} className="w-full relative bg-gradient-to-r from-icp-blue to-icp-teal hover:from-icp-teal hover:to-icp-blue text-white font-medium group bg-size-200 bg-pos-0 hover:bg-pos-100">
                      {loading ? (
                        'Processing...'
                      ) : (
                        <>
                          Continue to Payment <ArrowRight className="ml-2 h-4 w-4 transition-transform duration-200 group-hover:translate-x-1" />
                        </>
                      )}
                    </Button>
                  </div>
                </form>
              </CardContent>
            </TabsContent>

            <TabsContent value="withdraw">
              <CardContent>
                <form onSubmit={handleWithdraw}>
                  <div className="grid gap-4">
                    <div className="grid gap-2">
                      <label className="text-sm font-medium dark:text-slate-200">Amount to Withdraw</label>
                      <Input type="number" step="0.01" min="0" value={withdrawAmount} onChange={(e) => setWithdrawAmount(e.target.value)} className="border-slate-300 dark:border-slate-700 dark:bg-slate-800/70" placeholder="Enter amount" />
                    </div>
                    <div className="flex justify-between text-sm text-slate-500 dark:text-slate-400">
                      <span>Withdrawal Fee: 0.002 ICP</span>
                      <span>Available: {balance.toFixed(2)} ICP</span>
                    </div>
                    <Button type="submit" disabled={loading} className="w-full relative bg-gradient-to-r from-icp-blue to-icp-teal hover:from-icp-teal hover:to-icp-blue text-white font-medium group bg-size-200 bg-pos-0 hover:bg-pos-100">
                      {loading ? (
                        'Processing...'
                      ) : (
                        <>
                          Withdraw Funds <ArrowRight className="ml-2 h-4 w-4 transition-transform duration-200 group-hover:translate-x-1" />
                        </>
                      )}
                    </Button>
                  </div>
                </form>
              </CardContent>
            </TabsContent>

            <CardFooter className="flex justify-center p-6 border-t border-slate-200 dark:border-slate-700/50 text-sm text-slate-500 dark:text-slate-400">All transactions are encrypted and secure</CardFooter>
          </Tabs>
        </Card>
      </div>
    </div>
  );
};

export default Dbank;
