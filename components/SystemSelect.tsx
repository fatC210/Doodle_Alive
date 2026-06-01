'use client';

import { useEffect, useId, useMemo, useRef, useState } from 'react';
import type { KeyboardEvent } from 'react';
import { Check, ChevronDown } from 'lucide-react';

export type SystemSelectOption = {
  value: string;
  label: string;
};

type SystemSelectProps = {
  value: string;
  options: SystemSelectOption[];
  onChange: (value: string) => void;
  ariaLabel: string;
  placeholder?: string;
  className?: string;
};

const MENU_MAX_HEIGHT = 320;

export function SystemSelect({ value, options, onChange, ariaLabel, placeholder = '', className = '' }: SystemSelectProps) {
  const listboxId = useId();
  const buttonRef = useRef<HTMLButtonElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const selectedIndex = useMemo(() => options.findIndex((option) => option.value === value), [options, value]);
  const [open, setOpen] = useState(false);
  const [openUp, setOpenUp] = useState(false);
  const [activeIndex, setActiveIndex] = useState(Math.max(selectedIndex, 0));
  const selectedOption = selectedIndex >= 0 ? options[selectedIndex] : undefined;

  useEffect(() => {
    if (!open) return;

    function closeOnOutsideClick(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }

    document.addEventListener('pointerdown', closeOnOutsideClick);
    return () => document.removeEventListener('pointerdown', closeOnOutsideClick);
  }, [open]);

  function updateDirection() {
    const rect = buttonRef.current?.getBoundingClientRect();
    if (!rect) return;
    const spaceBelow = window.innerHeight - rect.bottom;
    const spaceAbove = rect.top;
    setOpenUp(spaceBelow < MENU_MAX_HEIGHT + 18 && spaceAbove > spaceBelow);
  }

  function toggleOpen() {
    updateDirection();
    if (!open) setActiveIndex(Math.max(selectedIndex, 0));
    setOpen((current) => !current);
  }

  function chooseOption(index: number) {
    const option = options[index];
    if (!option) return;
    onChange(option.value);
    setOpen(false);
    requestAnimationFrame(() => buttonRef.current?.focus());
  }

  function handleKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    if (!options.length) return;

    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      updateDirection();
      setOpen(true);
      setActiveIndex((current) => {
        const direction = event.key === 'ArrowDown' ? 1 : -1;
        const currentIndex = open ? current : Math.max(selectedIndex, 0);
        return (currentIndex + direction + options.length) % options.length;
      });
      return;
    }

    if (event.key === 'Home' || event.key === 'End') {
      event.preventDefault();
      updateDirection();
      setOpen(true);
      setActiveIndex(event.key === 'Home' ? 0 : options.length - 1);
      return;
    }

    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      if (open) chooseOption(activeIndex);
      else toggleOpen();
      return;
    }

    if (event.key === 'Escape') {
      setOpen(false);
      buttonRef.current?.focus();
    }
  }

  return (
    <div ref={rootRef} className={`system-select ${open ? 'open' : ''} ${openUp ? 'open-up' : ''} ${className}`.trim()}>
      <button
        ref={buttonRef}
        type="button"
        className="system-select-trigger"
        role="combobox"
        aria-label={ariaLabel}
        aria-controls={listboxId}
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-activedescendant={open ? `${listboxId}-${activeIndex}` : undefined}
        onClick={toggleOpen}
        onKeyDown={handleKeyDown}
      >
        <span>{selectedOption?.label || placeholder}</span>
        <ChevronDown size={18} className="system-select-chevron" aria-hidden="true" />
      </button>

      {open ? (
        <div id={listboxId} className="system-select-menu" role="listbox" aria-label={ariaLabel}>
          {options.map((option, index) => {
            const selected = option.value === value;
            const active = index === activeIndex;
            return (
              <button
                id={`${listboxId}-${index}`}
                key={option.value}
                type="button"
                className={`system-select-option ${selected ? 'selected' : ''} ${active ? 'active' : ''}`.trim()}
                role="option"
                aria-selected={selected}
                onMouseEnter={() => setActiveIndex(index)}
                onClick={() => chooseOption(index)}
              >
                <span>{option.label}</span>
                {selected ? <Check size={16} aria-hidden="true" /> : null}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
