import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function parseUtcDate(dateString: string | null | undefined): Date | null {
  if (!dateString) return null;
  // If the string already has a timezone (Z, +05:00, etc), don't modify it
  const hasTimezone = /(Z|[+-]\d{2}:\d{2})$/i.test(dateString);
  const safeDateString = hasTimezone ? dateString : `${dateString}Z`;
  return new Date(safeDateString);
}
