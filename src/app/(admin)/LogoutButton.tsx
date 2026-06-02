'use client'

import { useRouter } from 'next/navigation'

export default function LogoutButton() {
  const router = useRouter()

  async function logout() {
    await fetch('/api/auth/logout', { method: 'POST' })
    router.push('/login')
  }

  return (
    <button
      onClick={logout}
      className="w-full text-left px-3 py-2 text-xs text-gray-500 hover:text-gray-300 transition-colors"
    >
      Sign out
    </button>
  )
}
