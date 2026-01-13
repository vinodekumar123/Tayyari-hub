export const metadata = {
  title: 'TayyariHub',
  description: 'Entry Test Companion',
}

export default function QuizLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // Nested layouts should NOT re-declare <html> and <body> tags
  // Those belong only in the root app/layout.tsx
  return <>{children}</>;
}
