import './globals.css'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Time Tracker MVP',
  description: 'A comprehensive time tracking application with goal setting and vision planning',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className="dark-theme">{children}</body>
    </html>
  )
}
