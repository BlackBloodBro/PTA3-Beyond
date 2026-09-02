import { resetPassword } from '@/app/auth/actions'

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  const params = await searchParams

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 p-24">
      <h1 className="text-2xl font-bold">Reset password</h1>

      <p className="max-w-sm text-center text-sm text-muted">Choose a new password for your account.</p>

      {params.error && <p className="text-danger">{params.error}</p>}

      <form action={resetPassword} className="flex w-full max-w-sm flex-col gap-3">
        <label htmlFor="newPassword">New password</label>
        <input
          id="newPassword"
          name="newPassword"
          type="password"
          required
          minLength={6}
          className="bg-surface-subtle rounded border px-3 py-2"
        />

        <label htmlFor="confirmPassword">Confirm new password</label>
        <input
          id="confirmPassword"
          name="confirmPassword"
          type="password"
          required
          minLength={6}
          className="bg-surface-subtle rounded border px-3 py-2"
        />

        <button type="submit" className="mt-2 rounded bg-accent px-4 py-2 text-accent-foreground">
          Reset password
        </button>
      </form>
    </main>
  )
}
