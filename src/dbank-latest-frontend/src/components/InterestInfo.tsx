import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PiggyBank, TrendingUp, Landmark } from 'lucide-react';

export function InterestInfo() {
  const cards = [
    {
      title: 'Daily Interest Rate',
      value: 1,
      icon: <PiggyBank className="h-6 w-6 text-icp-blue dark:text-icp-teal" />,
      description: 'Fixed daily rate',
      gradient: 'from-blue-600 to-cyan-500 dark:from-teal-400 dark:to-cyan-300',
      bgGradient: 'from-blue-500/10 dark:from-teal-500/10',
    },
    {
      title: 'Monthly Returns',
      value: (1.01 ** 30 - 1) * 100,
      icon: <TrendingUp className="h-6 w-6 text-purple-600 dark:text-purple-400" />,
      description: 'Compound over 30 days',
      gradient: 'from-purple-600 to-pink-500 dark:from-purple-400 dark:to-pink-300',
      bgGradient: 'from-purple-500/10 dark:from-purple-500/10',
    },
    {
      title: 'Annual Returns',
      value: (1.01 ** 365 - 1) * 100,
      icon: <Landmark className="h-6 w-6 text-teal-600 dark:text-teal-400" />,
      description: 'Compound over 365 days',
      gradient: 'from-teal-600 to-emerald-500 dark:from-teal-400 dark:to-emerald-300',
      bgGradient: 'from-teal-500/10 dark:from-teal-500/10',
    },
  ];

  return (
    <div className="grid gap-6 md:grid-cols-3">
      {cards.map((card) => (
        <Card key={card.title} className="relative overflow-hidden transition-all duration-300 hover:shadow-lg hover:-translate-y-1 border-2 hover:border-slate-200 dark:hover:border-slate-700">
          <div className="absolute top-0 right-0 w-32 h-32 transform translate-x-8 -translate-y-8">
            <div className={`absolute inset-0 bg-gradient-radial ${card.bgGradient} to-transparent rounded-full blur-xl opacity-60`} />
          </div>
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-base font-medium flex items-center gap-2 text-slate-900 dark:text-slate-100">
              {card.icon}
              {card.title}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-baseline gap-1">
              <div className={`text-4xl font-bold bg-gradient-to-r ${card.gradient} bg-clip-text text-transparent`}>{card.value.toFixed(2)}</div>
              <span className="text-lg font-semibold text-slate-700 dark:text-slate-200">%</span>
            </div>
            <p className="text-sm text-slate-600 dark:text-slate-300 mt-2 font-medium">{card.description}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
