'use client'

import { useEffect } from 'react'
import clsx from 'clsx'

interface ToastProps {
  message: string
  type: 'success' | 'error' | 'info'
  onClose: () => void
}

export function Toast({ message, type, onClose }: ToastProps) {
  useEffect(() => {
    const timer = setTimeout(onClose, 3000)
    return () => clearTimeout(timer)
  }, [onClose])

  return (
    <div
      className={clsx(
        'animate-[slideInRight_250ms_ease] rounded-sm border px-[18px] py-3 text-[0.85rem] font-medium shadow-md',
        type === 'success' && 'border-success bg-success-soft text-success',
        type === 'error' && 'border-danger bg-danger-soft text-danger',
        type === 'info' && 'border-accent bg-accent-soft text-accent'
      )}
    >
      {message}
    </div>
  )
}
