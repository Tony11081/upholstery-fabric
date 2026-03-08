import { AdminSignIn } from "@/components/admin/admin-signin";

export const metadata = {
  title: "Admin sign in",
  robots: { index: false, follow: false },
};

type AdminSignInPageProps = {
  searchParams?: {
    callbackUrl?: string;
  };
};

export default function AdminSignInPage({ searchParams }: AdminSignInPageProps) {
  const callbackUrl = searchParams?.callbackUrl ?? "/admin";
  const passwordEnabled = Boolean(process.env.ADMIN_PASSWORD && process.env.ADMIN_EMAILS);

  return (
    <main className="min-h-screen bg-background px-4 pb-20 pt-10 sm:px-6 md:px-8">
      <div className="mx-auto max-w-2xl space-y-4 rounded-2xl border border-border bg-surface p-6 text-center shadow-[var(--shadow-soft)]">
        <p className="text-xs uppercase tracking-[0.2em] text-muted">Admin</p>
        <h1 className="font-display text-3xl">Sign in to admin</h1>
        <p className="text-sm text-muted">This area is for internal management only.</p>
        <div className="pt-4 text-left">
          <AdminSignIn callbackUrl={callbackUrl} passwordEnabled={passwordEnabled} />
        </div>
      </div>
    </main>
  );
}
