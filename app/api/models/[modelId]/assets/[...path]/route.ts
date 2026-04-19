import { NextRequest, NextResponse } from "next/server";
import fs from "node:fs";
import path from "node:path";
import { resolveAssetsDir } from "@/db/client";

interface Params {
  params: Promise<{ modelId: string; path: string[] }>;
}

export async function GET(req: NextRequest, { params }: Params) {
  const { modelId, path: pathParts } = await params;
  const assetsDir = resolveAssetsDir(modelId);
  const filePath = path.join(assetsDir, ...pathParts);

  // Prevent directory traversal
  if (!filePath.startsWith(assetsDir)) {
    return new NextResponse("Forbidden", { status: 403 });
  }

  if (!fs.existsSync(filePath)) {
    return new NextResponse("Not found", { status: 404 });
  }

  const data = fs.readFileSync(filePath);
  const ext = path.extname(filePath).toLowerCase();
  const contentType: Record<string, string> = {
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".gif": "image/gif",
    ".webp": "image/webp",
    ".svg": "image/svg+xml",
  };

  return new NextResponse(data, {
    headers: { "Content-Type": contentType[ext] ?? "application/octet-stream" },
  });
}
