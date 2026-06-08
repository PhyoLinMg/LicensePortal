'use client'

import { useState } from 'react'
import clsx from 'clsx'

export function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(text)
    } catch {
      const ta = document.createElement('textarea')
      ta.value = text
      ta.style.cssText = 'position:fixed;opacity:0'
      document.body.appendChild(ta)
      ta.focus()
      ta.select()
      document.execCommand('copy')
      document.body.removeChild(ta)
    }
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <button
      onClick={handleCopy}
      className={clsx(
        'key-copy-btn font-[inherit] text-[9px] tracking-[0.2em] bg-none border-0 cursor-pointer p-0 uppercase shrink-0 transition-colors duration-[150ms]',
        copied ? 'fg-green' : 'fg-amber',
      )}
    >
      {copied ? 'Copied ✓' : 'Copy'}
    </button>
  )
}
