export function StatePage({ title, message, action }: { title: string; message: string; action?: React.ReactNode }) {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 p-24 text-center">
      <h1 className="text-2xl font-bold">{title}</h1>
      <p className="text-sm text-muted">{message}</p>
      {action}
    </main>
  )
}
