import type { Metadata } from 'next'
import Navbar from '@/components/NavBar'
import './globals.css'

export const metadata: Metadata = {
  title: 'Box Office',
  description: 'Book seats for live events',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Navbar />
        <main>{children}</main>
      </body>
    </html>
  )
}