import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { createApiContext, jsonError, jsonOk, logApiError, logApiSuccess, logApiWarning } from "@/lib/utils/api";
import { getAdminSession } from "@/lib/auth/admin";
import { isOpenClawAdminRequest } from "@/lib/auth/openclaw-admin";

const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;

function getS3Client() {
  const { S3_REGION, S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY, S3_ENDPOINT, S3_FORCE_PATH_STYLE } = process.env;
  if (!S3_REGION || !S3_ACCESS_KEY_ID || !S3_SECRET_ACCESS_KEY) return null;
  return new S3Client({
    region: S3_REGION,
    endpoint: S3_ENDPOINT || undefined,
    forcePathStyle: S3_FORCE_PATH_STYLE === "true",
    credentials: {
      accessKeyId: S3_ACCESS_KEY_ID,
      secretAccessKey: S3_SECRET_ACCESS_KEY,
    },
  });
}

function buildPublicUrl(key: string) {
  const { S3_PUBLIC_URL, S3_ENDPOINT, S3_BUCKET, S3_REGION } = process.env;
  if (S3_PUBLIC_URL) {
    return `${S3_PUBLIC_URL.replace(/\/$/, "")}/${key}`;
  }
  if (S3_ENDPOINT && S3_BUCKET) {
    return `${S3_ENDPOINT.replace(/\/$/, "")}/${S3_BUCKET}/${key}`;
  }
  if (S3_BUCKET && S3_REGION) {
    return `https://${S3_BUCKET}.s3.${S3_REGION}.amazonaws.com/${key}`;
  }
  return `/${key}`;
}

export async function POST(request: Request) {
  const ctx = createApiContext(request);
  const session = await getAdminSession();
  const openclawAuthorized = isOpenClawAdminRequest(request);
  if (!session && !openclawAuthorized) {
    logApiWarning(ctx, 401, { authorized: false });
    return jsonError("Unauthorized", 401, ctx, { code: "UNAUTHORIZED" });
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    logApiWarning(ctx, 400, { reason: "invalid_form" });
    return jsonError("Invalid form data", 400, ctx, { code: "INVALID_BODY" });
  }

  const file = form.get("file");
  if (!(file instanceof File)) {
    logApiWarning(ctx, 400, { reason: "missing_file" });
    return jsonError("File is required", 400, ctx, { code: "VALIDATION_FAILED" });
  }

  if (!file.type.startsWith("image/")) {
    logApiWarning(ctx, 400, { reason: "invalid_type", type: file.type });
    return jsonError("Only image uploads are supported", 400, ctx, { code: "INVALID_FILE_TYPE" });
  }

  if (file.size > MAX_UPLOAD_BYTES) {
    logApiWarning(ctx, 400, { reason: "file_too_large", size: file.size });
    return jsonError("File exceeds size limit", 400, ctx, { code: "FILE_TOO_LARGE" });
  }

  try {
    const s3Client = getS3Client();
    const bucket = process.env.S3_BUCKET;
    const uploadsDir = path.join(process.cwd(), "public", "uploads");
    await mkdir(uploadsDir, { recursive: true });
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const filename = `${Date.now()}_${safeName}`;
    const buffer = Buffer.from(await file.arrayBuffer());
    const key = `uploads/${filename}`;

    if (s3Client && bucket) {
      await s3Client.send(
        new PutObjectCommand({
          Bucket: bucket,
          Key: key,
          Body: buffer,
          ContentType: file.type,
        }),
      );
      const url = buildPublicUrl(key);
      logApiSuccess(ctx, 200, { url, size: file.size, storage: "s3" });
      return jsonOk({ url }, ctx);
    }

    const filepath = path.join(uploadsDir, filename);
    await writeFile(filepath, buffer);

    const url = `/uploads/${filename}`;
    logApiSuccess(ctx, 200, { url, size: file.size, storage: "local" });
    return jsonOk({ url }, ctx);
  } catch (error) {
    logApiError(ctx, 500, error);
    return jsonError("Unable to upload file", 500, ctx, { code: "UPLOAD_FAILED" });
  }
}
