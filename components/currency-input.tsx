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
  const unsigned = value.replace(/[^\d.,]/g, "");
  let integer = "";
  let decimals = "";

  if (unsigned.includes(",")) {
    const decimalAt = unsigned.lastIndexOf(",");
    integer = unsigned.slice(0, decimalAt).replace(/\D/g, "");
    decimals = unsigned.slice(decimalAt + 1).replace(/\D/g, "").slice(0, 2);
  } else if (/^\d+\.\d{1,2}$/.test(unsigned)) {
    const [whole, fraction = ""] = unsigned.split(".");
    integer = whole;
    decimals = fraction.slice(0, 2);
  } else {
    integer = unsigned.replace(/\D/g, "");
  }

  integer = integer.replace(/^0+(?=\d)/, "");
  if (!integer && !decimals) return negative ? "-" : "";
  const canonical = decimals ? `${integer || "0"}.${decimals.padEnd(2, "0")}` : (integer || "0");
  return `${negative ? "-" : ""}${canonical}`;
}

function displayCurrency(value: string) {
  if (!value || value === "-") return value;
  const negative = value.startsWith("-");
  const unsigned = value.replace("-", "");
  const [integer = "0", decimals = ""] = unsigned.split(".");
  return `${negative ? "- " : ""}$ ${groupThousands(integer)},${decimals.padEnd(2, "0").slice(0, 2)}`;
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
