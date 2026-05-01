import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PiggyBank, TrendingUp, Landmark } from 'lucide-react';

const stats = [
  {
    title: 'Daily',
    value: 1,
    icon: PiggyBank,
    description: 'Fixed compounding rate per day.',
  },
  {
    title: 'Monthly',
    value: (1.01 ** 30 - 1) * 100,
    icon: TrendingUp,
    description: 'Compounded over 30 days.',
  },
  {
    title: 'Annual',
    value: (1.01 ** 365 - 1) * 100,
    icon: Landmark,
    description: 'Compounded over 365 days.',
  },
];

export function InterestInfo() {
  return (
    <div className="grid gap-px overflow-hidden rounded-[var(--radius)] border border-border bg-border md:grid-cols-3">
      {stats.map(({ title, value, icon: Icon, description }) => (
        <Card key={title} className="rounded-none border-0 bg-card">
          <CardHeader className="space-y-1.5">
            <Icon className="h-5 w-5 text-accent" aria-hidden />
            <CardTitle className="font-serif text-sm uppercase tracking-wider text-muted-foreground">
              {title}
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="flex items-baseline gap-1.5">
              <span className="font-serif text-5xl font-medium tabular-nums text-foreground">
                {value.toFixed(2)}
              </span>
              <span className="text-2xl text-muted-foreground">%</span>
            </div>
            <p className="mt-3 text-sm text-muted-foreground">{description}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
