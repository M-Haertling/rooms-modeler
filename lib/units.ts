import type { Unit } from "@/types/canvas";

export function formatLength(valueFeet: number, unit: Unit): string {
  if (unit === "standard") {
    const totalInches = valueFeet * 12;
    const feet = Math.floor(totalInches / 12);
    const inches = Math.round((totalInches % 12) * 10) / 10;
    if (feet === 0) return `${inches} in`;
    if (inches === 0) return `${feet} ft`;
    return `${feet} ft ${inches} in`;
  } else {
    const totalCm = valueFeet * 30.48;
    const meters = Math.floor(totalCm / 100);
    const cm = Math.round((totalCm % 100) * 10) / 10;
    if (meters === 0) return `${cm} cm`;
    if (cm === 0) return `${meters} m`;
    return `${meters} m ${cm} cm`;
  }
}

// Converts from display unit (inches for standard, cm for metric) to feet
export function convertToFeet(value: number, unit: Unit): number {
  if (unit === "standard") return value / 12;
  return value / 30.48;
}

// Converts from feet to display unit (inches for standard, cm for metric)
export function convertFromFeet(valueFeet: number, unit: Unit): number {
  if (unit === "standard") return valueFeet * 12;
  return valueFeet * 30.48;
}

export function unitLabel(unit: Unit): string {
  return unit === "standard" ? "in" : "cm";
}

export const UNIT_OPTIONS: { value: Unit; label: string }[] = [
  { value: "standard", label: "Standard (ft/in)" },
  { value: "metric", label: "Metric (m/cm)" },
];

// Splits a feet value into its compound parts for editing (ft+in or m+cm)
export function splitLengthFromFeet(valueFeet: number, unit: Unit): { primary: number; secondary: number } {
  if (unit === "standard") {
    const totalInches = valueFeet * 12;
    const feet = Math.floor(totalInches / 12);
    const inches = Math.round((totalInches % 12) * 100) / 100;
    return { primary: feet, secondary: inches };
  } else {
    const totalCm = valueFeet * 30.48;
    const meters = Math.floor(totalCm / 100);
    const cm = Math.round((totalCm % 100) * 100) / 100;
    return { primary: meters, secondary: cm };
  }
}

// Converts compound ft+in (or m+cm) values to feet, normalizing overflow (e.g. 26in → 2ft 2in)
export function compoundLengthToFeet(primary: number, secondary: number, unit: Unit): number {
  if (unit === "standard") {
    return ((primary < 0 ? 0 : primary) * 12 + (secondary < 0 ? 0 : secondary)) / 12;
  } else {
    return ((primary < 0 ? 0 : primary) * 100 + (secondary < 0 ? 0 : secondary)) / 30.48;
  }
}
