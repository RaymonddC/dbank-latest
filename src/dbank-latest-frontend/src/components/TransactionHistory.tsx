import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ArrowDownToLine, ArrowUpFromLine, Clock, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/contexts/AuthContext';
import { e8sToIcp, formatIcp } from '@/lib/icp';
import { downloadCsv, toCsv } from '@/lib/csv';

interface TransactionView {
  kind: { topUp: null } | { withdraw: null };
  amount: bigint;
  fee: bigint;
  balanceAfter: bigint;
  timestamp: bigint;
}

const INITIAL_LIMIT = 10;

const TransactionHistory = () => {
  const { actor: dbank, principal, isAuthenticated } = useAuth();
  const [showAll, setShowAll] = useState(false);

  const txQuery = useQuery({
    queryKey: ['transactions', principal?.toText() ?? 'anonymous'],
    queryFn: async (): Promise<TransactionView[]> => {
      if (!dbank) return [];
      return (await dbank.getTransactions()) as unknown as TransactionView[];
    },
    enabled: !!dbank && isAuthenticated,
  });

  const allTxs = (txQuery.data ?? []).slice().reverse();
  const visible = showAll ? allTxs : allTxs.slice(0, INITIAL_LIMIT);
  const hidden = allTxs.length - visible.length;

  const handleExport = () => {
    const header = ['Timestamp (ISO)', 'Kind', 'Amount (ICP)', 'Fee (ICP)', 'Balance After (ICP)'];
    const rows = allTxs.map((tx) => [
      new Date(Number(tx.timestamp / 1_000_000n)).toISOString(),
      'topUp' in tx.kind ? 'topUp' : 'withdraw',
      e8sToIcp(tx.amount).toString(),
      e8sToIcp(tx.fee).toString(),
      e8sToIcp(tx.balanceAfter).toString(),
    ]);
    const csv = toCsv([header, ...rows]);
    const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
    downloadCsv(`icp-finance-transactions-${stamp}.csv`, csv);
  };

  return (
    <Card>
      <CardHeader className="space-y-1.5 flex-row items-start justify-between gap-3">
        <div>
          <CardTitle className="font-serif text-lg">Recent activity</CardTitle>
          <CardDescription>Your most recent on-chain transactions.</CardDescription>
        </div>
        {allTxs.length > 0 && (
          <Button
            variant="outline"
            size="sm"
            onClick={handleExport}
            className="shrink-0"
            aria-label="Export transactions as CSV"
          >
            <Download className="mr-1.5 h-3.5 w-3.5" aria-hidden />
            Export
          </Button>
        )}
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
        ) : allTxs.length === 0 ? (
          <div className="flex items-center gap-2 py-2 text-sm text-muted-foreground">
            <Clock className="h-4 w-4" aria-hidden />
            <span>No transactions yet. Top up to get started.</span>
          </div>
        ) : (
          <>
            <ul className="divide-y divide-border">
              {visible.map((tx, i) => {
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
            {hidden > 0 && (
              <button
                type="button"
                onClick={() => setShowAll(true)}
                className="mt-3 w-full rounded-md border border-border bg-card py-2 text-sm font-medium text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
              >
                Show {hidden} more
              </button>
            )}
            {showAll && allTxs.length > INITIAL_LIMIT && (
              <button
                type="button"
                onClick={() => setShowAll(false)}
                className="mt-3 w-full rounded-md border border-border bg-card py-2 text-sm font-medium text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
              >
                Show fewer
              </button>
            )}
          </>
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
