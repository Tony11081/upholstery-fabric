import { NextRequest, NextResponse } from "next/server";

const DEFAULT_UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36";
const SZWEGO_REFERER = "https://www.szwego.com/";

function parseTargetUrl(raw: string): URL | null {
  try {
    const target = new URL(raw);
    if (target.protocol !== "http:" && target.protocol !== "https:") return null;
    return target;
  } catch {
    return null;
  }
}

async function fetchWithReferer(target: URL, referer?: string) {
  const headers: HeadersInit = {
    "User-Agent": DEFAULT_UA,
    Accept: "image/avif,image/webp,image/*,*/*;q=0.8",
  };

  if (referer) {
    headers.Referer = referer;
  }

  return fetch(target.toString(), {
    headers,
    redirect: "follow",
    signal: AbortSignal.timeout(12000),
  });
}

async function handleImageProxy(request: NextRequest) {
  const rawUrl = request.nextUrl.searchParams.get("url");
  if (!rawUrl) {
    return new NextResponse("Missing url parameter", { status: 400 });
  }

  const target = parseTargetUrl(rawUrl);
  if (!target) {
    return new NextResponse("Invalid image url", { status: 400 });
  }

  const primaryReferer = target.hostname.includes("szwego.com")
    ? SZWEGO_REFERER
    : `${target.protocol}//${target.host}/`;

  try {
    let response = await fetchWithReferer(target, primaryReferer);
    if (!response.ok) {
      response = await fetchWithReferer(target);
    }

    if (!response.ok) {
      return new NextResponse("Image not found", { status: response.status });
    }

    const contentType = response.headers.get("content-type") ?? "image/jpeg";
    const body = request.method === "HEAD" ? null : await response.arrayBuffer();

    return new NextResponse(body, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch {
    return new NextResponse("Failed to fetch image", { status: 502 });
  }
}

export async function GET(request: NextRequest) {
  return handleImageProxy(request);
}

export async function HEAD(request: NextRequest) {
  return handleImageProxy(request);
}
