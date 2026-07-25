"use client";

import { useState } from "react";

type CurrencyInputProps = {
  name: string;
  value?: string | number;
  defaultValue?: string | number;
  onValueChange?: (value: string) => void;
  className?: string;
  required?: boolean;
  allowNegative?: boolean;
  ariaLabel?: string;
};

const groupThousands = (value: string) =>
  value.replace(/\B(?=(\d{3})+(?!\d))/g, ".");

function normalize(value: string, allowNegative: boolean) {
  const negative = allowNegative && value.trim().startsWith("-");
  const digits = value.replace(/\D/g, "").replace(/^0+(?=\d)/, "");
  if (!digits) return negative ? "-" : "";
  return `${negative ? "-" : ""}${digits}`;
}

function displayCurrency(value: string) {
  if (!value || value === "-") return value;
  const negative = value.startsWith("-");
  const digits = value.replace(/\D/g, "");
  return `${negative ? "- " : ""}$ ${groupThousands(digits)}`;
}

export function CurrencyInput({
  name,
  value,
  defaultValue = "",
  onValueChange,
  className,
  required,
  allowNegative = false,
  ariaLabel,
}: CurrencyInputProps) {
  const controlled = value !== undefined;
  const [internalValue, setInternalValue] = useState(() => normalize(String(defaultValue), allowNegative));
  const rawValue = controlled ? normalize(String(value), allowNegative) : internalValue;

  return (
    <>
      <input
        type="text"
        inputMode="numeric"
        value={displayCurrency(rawValue)}
        onChange={(event) => {
          const nextValue = normalize(event.target.value, allowNegative);
          if (!controlled) setInternalValue(nextValue);
          onValueChange?.(nextValue);
        }}
        className={className}
        required={required}
        aria-label={ariaLabel}
        autoComplete="off"
      />
      <input type="hidden" name={name} value={rawValue === "-" ? "" : rawValue} />
    </>
  );
}
