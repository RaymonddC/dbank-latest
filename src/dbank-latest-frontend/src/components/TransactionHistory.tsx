import { useQuery } from '@tanstack/react-query';
import { ArrowDownToLine, ArrowUpFromLine, Clock } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/contexts/AuthContext';
import { formatIcp } from '@/lib/icp';

interface TransactionView {
  kind: { topUp: null } | { withdraw: null };
  amount: bigint;
  fee: bigint;
  balanceAfter: bigint;
  timestamp: bigint;
}

const TransactionHistory = () => {
  const { actor: dbank, principal, isAuthenticated } = useAuth();

  const txQuery = useQuery({
    queryKey: ['transactions', principal?.toText() ?? 'anonymous'],
    queryFn: async (): Promise<TransactionView[]> => {
      if (!dbank) return [];
      return (await dbank.getTransactions()) as unknown as TransactionView[];
    },
    enabled: !!dbank && isAuthenticated,
  });

  const txs = (txQuery.data ?? []).slice().reverse().slice(0, 10);

  return (
    <Card className="shadow-xl border-slate-200 dark:border-slate-700/50 glass-card">
      <CardHeader>
        <CardTitle className="text-lg">Recent Activity</CardTitle>
        <CardDescription>Your last {txs.length || 'few'} transactions</CardDescription>
      </CardHeader>
      <CardContent>
        {txQuery.isLoading ? (
          <ul className="divide-y divide-slate-200 dark:divide-slate-800" aria-busy>
            {[0, 1, 2].map((i) => (
              <li key={i} className="flex items-center justify-between py-3">
                <div className="flex items-center gap-3">
                  <Skeleton className="h-8 w-8 rounded-full" />
                  <div className="flex flex-col gap-1">
                    <Skeleton className="h-4 w-20" />
                    <Skeleton className="h-3 w-28" />
                  </div>
                </div>
                <Skeleton className="h-4 w-24" />
              </li>
            ))}
          </ul>
        ) : txs.length === 0 ? (
          <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
            <Clock className="h-4 w-4" aria-hidden />
            <span>No transactions yet. Top up to get started.</span>
          </div>
        ) : (
          <ul className="divide-y divide-slate-200 dark:divide-slate-800">
            {txs.map((tx, i) => {
              const isTopUp = 'topUp' in tx.kind;
              return (
                <li key={i} className="flex items-center justify-between py-3 text-sm">
                  <div className="flex items-center gap-3">
                    <div
                      className={
                        isTopUp
                          ? 'p-2 rounded-full bg-emerald-100 dark:bg-emerald-900/30'
                          : 'p-2 rounded-full bg-amber-100 dark:bg-amber-900/30'
                      }
                    >
                      {isTopUp ? (
                        <ArrowDownToLine className="h-4 w-4 text-emerald-600 dark:text-emerald-400" aria-hidden />
                      ) : (
                        <ArrowUpFromLine className="h-4 w-4 text-amber-600 dark:text-amber-400" aria-hidden />
                      )}
                    </div>
                    <div className="flex flex-col">
                      <span className="font-medium text-slate-800 dark:text-slate-100">
                        {isTopUp ? 'Top up' : 'Withdrawal'}
                      </span>
                      <span className="text-xs text-slate-500 dark:text-slate-400">{formatTimestamp(tx.timestamp)}</span>
                    </div>
                  </div>
                  <div className="flex flex-col items-end">
                    <span className={isTopUp ? 'font-mono text-emerald-700 dark:text-emerald-300' : 'font-mono text-amber-700 dark:text-amber-300'}>
                      {isTopUp ? '+' : '−'}
                      {formatIcp(tx.amount)} ICP
                    </span>
                    <span className="text-xs text-slate-500 dark:text-slate-400 font-mono">
                      bal {formatIcp(tx.balanceAfter)}
                    </span>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
};

function formatTimestamp(ns: bigint): string {
  const ms = Number(ns / 1_000_000n);
  return new Date(ms).toLocaleString();
}

export default TransactionHistory;
