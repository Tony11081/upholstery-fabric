import { Suspense } from "react";
import { AdminAuthState } from "@/components/admin/admin-auth-state";
import { SendEmailClient } from "@/components/admin/send-email-client";
import { isAdminEmail } from "@/lib/auth/admin";
import { getAuthSession } from "@/lib/auth/session";

export const metadata = {
  title: "后台 - 发送邮件",
};

export default async function AdminSendEmailPage() {
  const session = await getAuthSession();
  const isAdmin = isAdminEmail(session?.user?.email);

  if (!session?.user?.email) {
    return <AdminAuthState variant="signin" callbackUrl="/admin/email" />;
  }

  if (!isAdmin) {
    return <AdminAuthState variant="denied" />;
  }

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <p className="text-xs uppercase tracking-[0.2em] text-muted">后台</p>
        <h1 className="font-display text-3xl leading-tight">发送邮件</h1>
        <p className="text-sm text-muted">向一个或多个收件人手动发送邮件。</p>
      </div>
      <Suspense fallback={<div className="text-sm text-muted">加载中...</div>}>
        <SendEmailClient />
      </Suspense>
    </div>
  );
}
