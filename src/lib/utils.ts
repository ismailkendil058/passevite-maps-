import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function getPersistentAuth(key: string) {
  try {
    return localStorage.getItem(key);
  } catch (e) {
    return null;
  }
}
