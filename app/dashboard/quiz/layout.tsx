export const metadata = {
  title: 'TayyariHub',
  description: 'Entry Test Companion',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
