'use client'

import { useEffect, useState } from 'react'

export default function DarkModeToggle() {
  const [dark, setDark] = useState(false)

  useEffect(() => {
    // Sync React state with whatever the inline script already applied to <html>
    setDark(document.documentElement.classList.contains('dark'))
  }, [])

  function toggle() {
    // Always read directly from the DOM — never from stale React state
    const isCurrentlyDark = document.documentElement.classList.contains('dark')

    if (isCurrentlyDark) {
      document.documentElement.classList.remove('dark')
      localStorage.setItem('theme', 'light')
      setDark(false)
    } else {
      document.documentElement.classList.add('dark')
      localStorage.setItem('theme', 'dark')
      setDark(true)
    }
  }

  return (
    <button
      onClick={toggle}
      suppressHydrationWarning
      className="flex items-center gap-3 px-3 py-2 w-full rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-100 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-100 transition-colors"
      title={dark ? 'Switch to light mode' : 'Switch to dark mode'}
    >
      <span className="text-base" suppressHydrationWarning>
        {dark ? '☀️' : '🌙'}
      </span>
      <span suppressHydrationWarning>
        {dark ? 'Light mode' : 'Dark mode'}
      </span>
    </button>
  )
}
