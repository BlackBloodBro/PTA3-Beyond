import Link from 'next/link'
import { signup } from '@/app/auth/actions'

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  const params = await searchParams

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 p-24">
      <h1 className="text-2xl font-bold">Sign up</h1>

      {params.error && <p className="text-danger">{params.error}</p>}

      <form action={signup} className="flex w-full max-w-sm flex-col gap-3">
        <label htmlFor="displayName">Display name</label>
        <input id="displayName" name="displayName" type="text" className="bg-surface-subtle rounded border px-3 py-2" />

        <label htmlFor="email">Email</label>
        <input id="email" name="email" type="email" required className="bg-surface-subtle rounded border px-3 py-2" />

        <label htmlFor="password">Password</label>
        <input
          id="password"
          name="password"
          type="password"
          required
          minLength={6}
          className="bg-surface-subtle rounded border px-3 py-2"
        />

        <button type="submit" className="mt-2 rounded bg-accent px-4 py-2 text-accent-foreground">
          Sign up
        </button>
      </form>

      <p className="text-sm text-muted">
        Already have an account?{' '}
        <Link href="/login" className="underline">
          Log in
        </Link>
      </p>
    </main>
  )
}
