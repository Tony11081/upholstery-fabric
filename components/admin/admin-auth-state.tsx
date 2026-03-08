import Link from "next/link";

type AdminAuthStateProps = {
  variant: "signin" | "denied";
  callbackUrl?: string;
};

export function AdminAuthState({ variant, callbackUrl }: AdminAuthStateProps) {
  const isSignin = variant === "signin";
  return (
    <div className="mx-auto max-w-2xl space-y-4 rounded-2xl border border-border bg-surface p-6 text-center shadow-[var(--shadow-soft)]">
      <p className="text-xs uppercase tracking-[0.2em] text-muted">后台</p>
      <h1 className="font-display text-3xl">{isSignin ? "需要登录" : "访问被拒绝"}</h1>
      <p className="text-sm text-muted">
        {isSignin
          ? "请先使用管理员账号登录后再访问此页面。"
          : "当前账号没有后台访问权限。"}
      </p>
      <div className="pt-4">
        {isSignin ? (
          <Link
            href={`/admin-login?callbackUrl=${encodeURIComponent(callbackUrl ?? "/admin")}`}
            className="rounded-full border border-border px-4 py-2 text-sm font-medium"
          >
            去登录
          </Link>
        ) : (
          <Link href="/" className="text-sm underline underline-offset-4">
            返回首页
          </Link>
        )}
      </div>
    </div>
  );
}
