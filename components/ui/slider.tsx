'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';

interface SliderProps extends Omit<
  React.ComponentPropsWithoutRef<'input'>,
  'value' | 'onChange'
> {
  value?: number[];
  onValueChange?: (value: number[]) => void;
  min?: number;
  max?: number;
  step?: number;
}

const Slider = React.forwardRef<HTMLInputElement, SliderProps>(
  (
    {
      value = [0],
      onValueChange,
      min = 0,
      max = 100,
      step = 1,
      className,
      disabled,
      ...props
    },
    ref
  ) => {
    const current = value?.[0] ?? min;

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const v = Number(e.target.value);
      onValueChange?.([v]);
    };

    return (
      <input
        type="range"
        ref={ref}
        min={min}
        max={max}
        step={step}
        value={current}
        onChange={handleChange}
        disabled={disabled}
        className={cn(
          'h-2 w-full appearance-none rounded-lg bg-slate-200/60 transition-colors disabled:opacity-50',
          'accent-primary/70 focus:outline-none focus:ring-2 focus:ring-ring/50',
          className
        )}
        {...props}
      />
    );
  }
);
Slider.displayName = 'Slider';

export { Slider };
