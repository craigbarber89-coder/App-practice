'use client'

import { useEffect, useState } from 'react'

export default function ThemeToggle() {
  const [dark, setDark] = useState(false)

  useEffect(() => {
    setDark(document.documentElement.classList.contains('dark'))
  }, [])

  function toggle() {
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
      title={dark ? 'Switch to light mode' : 'Switch to dark mode'}
      className="p-2 rounded-full bg-white/70 dark:bg-gray-800/70 backdrop-blur-sm border border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 hover:bg-white dark:hover:bg-gray-800 shadow-sm transition-colors"
    >
      <span suppressHydrationWarning className="text-base leading-none">
        {dark ? '☀️' : '🌙'}
      </span>
    </button>
  )
}
