import Link from 'next/link'
import { requestPasswordReset } from '@/app/auth/actions'

export default async function ForgotPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  const params = await searchParams

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 p-24">
      <h1 className="text-2xl font-bold">Forgot password</h1>

      <p className="max-w-sm text-center text-sm text-muted">
        Enter the email you signed up with, and we&apos;ll send you a link to reset your password.
      </p>

      {params.error && <p className="text-danger">{params.error}</p>}

      <form action={requestPasswordReset} className="flex w-full max-w-sm flex-col gap-3">
        <label htmlFor="email">Email</label>
        <input id="email" name="email" type="email" required className="bg-surface-subtle rounded border px-3 py-2" />

        <button type="submit" className="mt-2 rounded bg-accent px-4 py-2 text-accent-foreground">
          Send reset link
        </button>
      </form>

      <p className="text-sm text-muted">
        <Link href="/login" className="underline">
          Back to log in
        </Link>
      </p>
    </main>
  )
}
