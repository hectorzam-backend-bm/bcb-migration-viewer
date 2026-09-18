import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...entradas: Array<ClassValue>) {
  return twMerge(clsx(entradas))
}
