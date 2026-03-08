"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/lib/hooks/useToast";

type AdminSignInProps = {
  callbackUrl: string;
  passwordEnabled: boolean;
};

export function AdminSignIn({ callbackUrl, passwordEnabled }: AdminSignInProps) {
  const [password, setPassword] = useState("");
  const [loadingPassword, setLoadingPassword] = useState(false);
  const toast = useToast();

  const handlePasswordSignIn = async () => {
    if (!passwordEnabled) {
      toast.error("未配置密码登录");
      return;
    }
    if (!password.trim()) {
      toast.error("请输入管理员密码");
      return;
    }
    const adminTarget = callbackUrl.startsWith("/admin") ? callbackUrl : "/admin";
    setLoadingPassword(true);
    try {
      const result = await signIn("credentials", {
        password: password.trim(),
        callbackUrl: adminTarget,
        redirect: false,
      });
      if (result?.error) {
        const message = result.error === "CredentialsSignin" ? "密码错误" : result.error;
        throw new Error(message);
      }
      toast.success("登录成功");
      window.location.href = result?.url ?? adminTarget;
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "登录失败");
    } finally {
      setLoadingPassword(false);
    }
  };

  return (
    <div className="space-y-3 rounded-xl border border-border bg-contrast px-4 py-4">
      <div className="flex items-center justify-between text-xs uppercase tracking-[0.18em] text-muted">
        <span>后台登录</span>
        <span>密码验证</span>
      </div>
      <Input
        label="管理员密码"
        type="password"
        value={password}
        onChange={(event) => setPassword(event.target.value)}
        placeholder="输入管理员密码"
      />
      <Button
        type="button"
        className="w-full rounded-full"
        onClick={handlePasswordSignIn}
        loading={loadingPassword}
        disabled={!passwordEnabled}
      >
        使用密码登录
      </Button>
      {!passwordEnabled && (
        <p className="text-xs text-muted">尚未启用后台密码登录。</p>
      )}
    </div>
  );
}
