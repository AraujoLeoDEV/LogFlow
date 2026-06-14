'use client';

import * as React from 'react';
import { ChevronLeftIcon, ChevronRightIcon } from 'lucide-react';

import { cn } from '@/lib/utils';
import { buttonVariants } from '@/components/ui/button';

const WEEKDAY_LABELS = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];

interface CalendarProps {
  selected?: Date;
  onSelect: (date: Date) => void;
  month?: Date;
  className?: string;
}

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function Calendar({ selected, onSelect, month, className }: CalendarProps) {
  const [viewMonth, setViewMonth] = React.useState(() => month ?? selected ?? new Date());

  const changeMonth = (delta: number) => {
    setViewMonth((current) => new Date(current.getFullYear(), current.getMonth() + delta, 1));
  };

  const firstOfMonth = new Date(viewMonth.getFullYear(), viewMonth.getMonth(), 1);
  const startWeekday = firstOfMonth.getDay();
  const daysInMonth = new Date(viewMonth.getFullYear(), viewMonth.getMonth() + 1, 0).getDate();

  const days: (Date | null)[] = [];
  for (let i = 0; i < startWeekday; i += 1) {
    days.push(null);
  }
  for (let day = 1; day <= daysInMonth; day += 1) {
    days.push(new Date(viewMonth.getFullYear(), viewMonth.getMonth(), day));
  }

  const today = new Date();

  return (
    <div className={cn('w-64', className)}>
      <div className="mb-2 flex items-center justify-between">
        <button
          type="button"
          className={cn(buttonVariants({ variant: 'ghost', size: 'icon-sm' }))}
          onClick={() => changeMonth(-1)}
          aria-label="Mês anterior"
        >
          <ChevronLeftIcon />
        </button>
        <span className="text-sm font-medium capitalize">
          {viewMonth.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}
        </span>
        <button
          type="button"
          className={cn(buttonVariants({ variant: 'ghost', size: 'icon-sm' }))}
          onClick={() => changeMonth(1)}
          aria-label="Próximo mês"
        >
          <ChevronRightIcon />
        </button>
      </div>
      <div className="grid grid-cols-7 gap-1 text-center text-xs text-muted-foreground">
        {WEEKDAY_LABELS.map((label, index) => (
          <span key={index} className="flex h-7 items-center justify-center">
            {label}
          </span>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {days.map((day, index) => {
          if (!day) {
            return <span key={index} />;
          }

          const isSelected = selected ? isSameDay(day, selected) : false;
          const isToday = isSameDay(day, today);

          return (
            <button
              key={index}
              type="button"
              onClick={() => onSelect(day)}
              className={cn(
                'flex h-7 w-7 items-center justify-center rounded-md text-sm transition-colors hover:bg-accent hover:text-accent-foreground',
                isSelected && 'bg-primary text-primary-foreground hover:bg-primary/90',
                !isSelected && isToday && 'border border-ring',
              )}
            >
              {day.getDate()}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export { Calendar };
