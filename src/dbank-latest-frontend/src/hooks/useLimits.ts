import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';

interface Limits {
  maxTxAmount: bigint;
  maxTxLog: bigint;
  minOpIntervalNs: bigint;
  accrueInterest: boolean;
}

const FALLBACK: Limits = {
  maxTxAmount: 0n,
  maxTxLog: 0n,
  minOpIntervalNs: 0n,
  accrueInterest: false, // assume custody mode if we can't reach the canister
};

export function useLimits(): Limits {
  const { actor: dbank } = useAuth();
  const query = useQuery({
    queryKey: ['limits'],
    queryFn: async (): Promise<Limits> => {
      if (!dbank) throw new Error('No actor');
      return (await dbank.getLimits()) as Limits;
    },
    enabled: !!dbank,
    staleTime: Infinity,
  });
  return query.data ?? FALLBACK;
}
