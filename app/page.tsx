import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';

export default async function HomePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 p-24">
      <h1 className="text-3xl font-bold">PTA3 Tool</h1>
      <p className="text-muted">Trainers, Pokémon, and reference data go here.</p>

      {user ? (
        <Link href="/dashboard" className="underline">
          Go to dashboard
        </Link>
      ) : (
        <div className="flex gap-4">
          <Link href="/login" className="underline">
            Log in
          </Link>
          <Link href="/signup" className="underline">
            Sign up
          </Link>
        </div>
      )}
    </main>
  );
}
