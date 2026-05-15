import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const version = process.env.NEXT_PUBLIC_EXTENSION_VERSION ?? "0.1.0";
  const downloadPath =
    process.env.NEXT_PUBLIC_EXTENSION_DOWNLOAD_PATH ??
    "/downloads/oddzone-extension.zip";

  const downloadUrl = new URL(downloadPath, requestUrl.origin).toString();

  return NextResponse.json({
    version,
    downloadUrl,
    publishedAt: new Date().toISOString()
  });
}
