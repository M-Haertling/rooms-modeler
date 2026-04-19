import type { Unit } from "@/types/canvas";

const TO_FEET: Record<Unit, number> = {
  feet: 1,
  inches: 1 / 12,
  cm: 1 / 30.48,
  m: 1 / 0.3048,
  mm: 1 / 304.8,
};

const LABELS: Record<Unit, string> = {
  feet: "ft",
  inches: "in",
  cm: "cm",
  m: "m",
  mm: "mm",
};

export function convertFromFeet(valueFeet: number, unit: Unit): number {
  return valueFeet / TO_FEET[unit];
}

export function convertToFeet(value: number, unit: Unit): number {
  return value * TO_FEET[unit];
}

export function formatLength(valueFeet: number, unit: Unit, decimals = 2): string {
  const converted = convertFromFeet(valueFeet, unit);
  return `${converted.toFixed(decimals)} ${LABELS[unit]}`;
}

export const UNIT_OPTIONS: { value: Unit; label: string }[] = [
  { value: "feet", label: "Feet (ft)" },
  { value: "inches", label: "Inches (in)" },
  { value: "m", label: "Meters (m)" },
  { value: "cm", label: "Centimeters (cm)" },
  { value: "mm", label: "Millimeters (mm)" },
];
