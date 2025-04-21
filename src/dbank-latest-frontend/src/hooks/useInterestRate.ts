import { useState } from 'react';

export function useInterestRate() {
  const [rate, setRate] = useState<number>(Number(import.meta.env.VITE_DAILY_INTEREST_RATE) || 1);
  const [loading, setLoading] = useState(false);

  // No need to fetch since we're using env variable
  return { rate, loading };
}
