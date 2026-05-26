import { NextResponse } from "next/server";
import { readdir, stat } from "fs/promises";
import { join, relative } from "path";
import { existsSync } from "fs";

const FORGE_DIR = join(process.cwd(), "forge-output");

async function scanDir(dir: string, category: string): Promise<any[]> {
  const entries: any[] = [];
  try {
    const files = await readdir(dir, { withFileTypes: true });
    for (const f of files) {
      const fullPath = join(dir, f.name);
      if (f.isDirectory()) {
        // Recurse with category = folder name
        const sub = await scanDir(fullPath, f.name);
        entries.push(...sub);
      } else if (f.name.endsWith(".png")) {
        const s = await stat(fullPath).catch(() => ({ size: 0 }));
        const rel = relative(FORGE_DIR, fullPath).replace(/\\/g, "/");
        entries.push({
          id: rel.replace(/\.png$/i, "").replace(/\//g, "-"),
          name: f.name.replace(/\.png$/i, "").replace(/_/g, " ").replace(/-/g, " ").replace(/\b\w/g, (c: string) => c.toUpperCase()),
          filename: f.name,
          category,
          size: s.size,
          path: `/api/library/image?file=${encodeURIComponent(rel)}`,
          relPath: rel,
        });
      }
    }
  } catch {}
  return entries;
}

export async function GET(req: Request) {
  try {
    if (!existsSync(FORGE_DIR)) {
      return NextResponse.json({ assets: [], error: "forge-output not found" });
    }

    const { searchParams } = new URL(req.url);
    const catFilter = searchParams.get("category");
    const search = searchParams.get("search")?.toLowerCase();

    let allAssets: any[] = [];

    const topFiles = await readdir(FORGE_DIR, { withFileTypes: true });
    for (const f of topFiles) {
      const fullPath = join(FORGE_DIR, f.name);
      if (f.isDirectory()) {
        if (catFilter && catFilter !== "all" && f.name !== catFilter) continue;
        const sub = await scanDir(fullPath, f.name);
        allAssets.push(...sub);
      } else if (f.name.endsWith(".png")) {
        if (catFilter && catFilter !== "all" && catFilter !== "root") continue;
        const s = await stat(fullPath).catch(() => ({ size: 0 }));
        allAssets.push({
          id: f.name.replace(/\.png$/i, ""),
          name: f.name.replace(/\.png$/i, "").replace(/_/g, " ").replace(/-/g, " ").replace(/\b\w/g, (c: string) => c.toUpperCase()),
          filename: f.name,
          category: "root",
          size: s.size,
          path: `/api/library/image?file=${encodeURIComponent(f.name)}`,
          relPath: f.name,
        });
      }
    }

    // Filter by search
    if (search) {
      allAssets = allAssets.filter(
        (a) =>
          a.name.toLowerCase().includes(search) ||
          a.category.toLowerCase().includes(search)
      );
    }

    // Sort by category then name
    allAssets.sort((a, b) => {
      if (a.category !== b.category) return a.category.localeCompare(b.category);
      return a.name.localeCompare(b.name);
    });

    return NextResponse.json({ assets: allAssets, total: allAssets.length });
  } catch (e: any) {
    return NextResponse.json({ assets: [], error: e.message }, { status: 500 });
  }
}
