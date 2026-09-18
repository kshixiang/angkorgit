import { useEffect, useRef } from 'react';
import { Search, X } from 'lucide-react';
import { Button, Input, cn } from '@gitmd/design-system';

let consumedFocusSeq = 0;

export function FileFilterInput({
  value,
  onChange,
  onClose,
  focusSeq = 0,
  placeholder = 'Filter files…',
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  onClose?: () => void;
  focusSeq?: number;
  placeholder?: string;
  className?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (focusSeq === 0 || focusSeq === consumedFocusSeq) return;
    consumedFocusSeq = focusSeq;
    inputRef.current?.focus();
  }, [focusSeq]);
  return (
    <div className={cn('relative min-w-0', className)}>
      <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-faint" />
      <Input
        ref={inputRef}
        value={value}
        aria-label={placeholder.replace(/…$/, '')}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key !== 'Escape') return;
          e.preventDefault();
          e.stopPropagation();
          if (value) onChange('');
          else onClose?.();
        }}
        className={cn('h-7 border-transparent bg-surface-raised pl-8 text-xs', value && 'pr-7')}
      />
      {value && (
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="Clear filter"
          className="absolute right-0.5 top-1/2 size-6 -translate-y-1/2"
          onClick={() => onChange('')}
        >
          <X className="size-3" />
        </Button>
      )}
    </div>
  );
}
