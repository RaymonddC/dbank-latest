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
    <Card>
      <CardHeader className="space-y-1.5">
        <CardTitle className="font-serif text-lg">Recent activity</CardTitle>
        <CardDescription>Your most recent on-chain transactions.</CardDescription>
      </CardHeader>
      <CardContent>
        {txQuery.isLoading ? (
          <ul className="divide-y divide-border" aria-busy>
            {[0, 1, 2].map((i) => (
              <li key={i} className="flex items-center justify-between py-3">
                <div className="flex items-center gap-3">
                  <Skeleton className="h-8 w-8 rounded-full" />
                  <div className="flex flex-col gap-1">
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-3 w-32" />
                  </div>
                </div>
                <Skeleton className="h-4 w-20" />
              </li>
            ))}
          </ul>
        ) : txs.length === 0 ? (
          <div className="flex items-center gap-2 py-2 text-sm text-muted-foreground">
            <Clock className="h-4 w-4" aria-hidden />
            <span>No transactions yet. Top up to get started.</span>
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {txs.map((tx, i) => {
              const isTopUp = 'topUp' in tx.kind;
              return (
                <li key={i} className="flex items-center justify-between py-3 text-sm">
                  <div className="flex items-center gap-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-secondary text-foreground">
                      {isTopUp ? (
                        <ArrowDownToLine className="h-4 w-4" aria-hidden />
                      ) : (
                        <ArrowUpFromLine className="h-4 w-4" aria-hidden />
                      )}
                    </div>
                    <div className="flex flex-col">
                      <span className="font-medium text-foreground">{isTopUp ? 'Top up' : 'Withdrawal'}</span>
                      <span className="text-xs text-muted-foreground">{formatTimestamp(tx.timestamp)}</span>
                    </div>
                  </div>
                  <div className="flex flex-col items-end">
                    <span className="font-mono text-foreground tabular-nums">
                      {isTopUp ? '+' : '−'}
                      {formatIcp(tx.amount)} ICP
                    </span>
                    <span className="text-xs font-mono text-muted-foreground tabular-nums">
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
