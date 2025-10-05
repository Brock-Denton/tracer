import './globals.css'
import type { Metadata } from 'next'
import ServiceWorkerRegistration from './components/ServiceWorkerRegistration'

export const metadata: Metadata = {
  title: 'Time Tracker MVP',
  description: 'A comprehensive time tracking application with goal setting and vision planning',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Time Tracker',
  },
  formatDetection: {
    telephone: false,
  },
  openGraph: {
    type: 'website',
    siteName: 'Time Tracker MVP',
    title: 'Time Tracker MVP',
    description: 'A comprehensive time tracking application with goal setting and vision planning',
  },
}

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: '#3b82f6',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <head>
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#3b82f6" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="Time Tracker" />
        <link rel="apple-touch-icon" href="/icons/icon-192x192.png" />
        <meta name="msapplication-TileColor" content="#3b82f6" />
        <meta name="msapplication-tap-highlight" content="no" />
      </head>
      <body className="dark-theme">
        <ServiceWorkerRegistration />
        {children}
      </body>
    </html>
  )
}
