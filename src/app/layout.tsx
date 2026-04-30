import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { businessConfig } from '@config'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: businessConfig.name,
  description: businessConfig.tagline,
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Inline script runs before paint — prevents flash of wrong theme */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('theme');var d=window.matchMedia('(prefers-color-scheme: dark)').matches;if(t==='dark'||(t===null&&d)){document.documentElement.classList.add('dark')}}catch(e){}})()`,
          }}
        />
      </head>
      <body className={inter.className}>{children}</body>
    </html>
  )
}
