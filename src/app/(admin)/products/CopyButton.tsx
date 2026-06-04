'use client'

import { useState } from 'react'

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
      style={{
        fontFamily: 'inherit',
        fontSize: 9,
        letterSpacing: '0.2em',
        color: copied ? 'var(--green)' : 'var(--amber)',
        background: 'none',
        border: 'none',
        cursor: 'pointer',
        padding: 0,
        textTransform: 'uppercase',
        flexShrink: 0,
        transition: 'color 0.15s',
      }}
    >
      {copied ? 'Copied ✓' : 'Copy'}
    </button>
  )
}
