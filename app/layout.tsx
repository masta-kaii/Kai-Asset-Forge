import type { Metadata } from "next"
import { Geist, Geist_Mono, VT323 } from "next/font/google"
import "./globals.css"

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] })
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] })
const vt323 = VT323({ weight: "400", variable: "--font-vt323", subsets: ["latin"] })

export const metadata: Metadata = {
  title: "KAI Asset Forge — Pixel Factory",
  description: "Hermes OS v5 · Autonomous pixel art production pipeline",
}

export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} ${vt323.variable} h-full antialiased`} style={{WebkitTextSizeAdjust:"100%"}}>
      <body className="min-h-full">{children}</body>
    </html>
  )
}
