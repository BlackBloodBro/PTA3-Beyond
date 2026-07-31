import Link from 'next/link'
import { login } from '@/app/auth/actions'

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; message?: string }>
}) {
  const params = await searchParams

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 p-24">
      <h1 className="text-2xl font-bold">Log in</h1>

      {params.message && <p className="text-green-600">{params.message}</p>}
      {params.error && <p className="text-red-600">{params.error}</p>}

      <form action={login} className="flex w-full max-w-sm flex-col gap-3">
        <label htmlFor="email">Email</label>
        <input id="email" name="email" type="email" required className="rounded border px-3 py-2" />

        <label htmlFor="password">Password</label>
        <input id="password" name="password" type="password" required className="rounded border px-3 py-2" />

        <button type="submit" className="mt-2 rounded bg-black px-4 py-2 text-white">
          Log in
        </button>
      </form>

      <p className="text-sm text-neutral-500">
        No account?{' '}
        <Link href="/signup" className="underline">
          Sign up
        </Link>
      </p>
    </main>
  )
}
