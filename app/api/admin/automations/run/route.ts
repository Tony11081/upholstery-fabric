import { dispatchPendingAutomations } from "@/lib/automation/engine";
import { getAdminSession } from "@/lib/auth/admin";
import { createApiContext, jsonError, jsonOk, logApiError, logApiSuccess, logApiWarning } from "@/lib/utils/api";

export async function POST(request: Request) {
  const ctx = createApiContext(request);
  const session = await getAdminSession();
  if (!session) {
    logApiWarning(ctx, 401, { authorized: false });
    return jsonError("Unauthorized", 401, ctx, { code: "UNAUTHORIZED" });
  }

  try {
    await dispatchPendingAutomations(50);
    logApiSuccess(ctx, 200);
    return jsonOk({ ok: true }, ctx);
  } catch (error) {
    logApiError(ctx, 500, error);
    return jsonError("Unable to dispatch automations", 500, ctx, { code: "AUTOMATION_DISPATCH_FAILED" });
  }
}

