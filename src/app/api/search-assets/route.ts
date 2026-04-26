import { NextRequest } from "next/server";

// Roblox Toolbox Search – uses 3 Roblox APIs:
//   1. Toolbox search (returns asset IDs)
//   2. Economy details (returns names + creator)
//   3. Thumbnails (returns image URLs)
export async function GET(req: NextRequest) {
  const query = req.nextUrl.searchParams.get("q") || "";

  if (!query.trim()) {
    return Response.json({ results: [] });
  }

  try {
    // Step 1: Search the toolbox marketplace (assetType 10 = Models)
    const searchUrl = `https://apis.roblox.com/toolbox-service/v1/marketplace/10?keyword=${encodeURIComponent(query)}&num=12&sortType=Relevance&includeOnlyVerifiedCreators=false`;

    const searchRes = await fetch(searchUrl, {
      headers: { Accept: "application/json" },
    });

    if (!searchRes.ok) {
      console.error("Toolbox search failed:", searchRes.status, await searchRes.text().catch(() => ""));
      return Response.json({ results: [], error: "Roblox search failed" });
    }

    const searchData = await searchRes.json();
    const rawItems = searchData?.data || [];
    const assetIds: number[] = rawItems.slice(0, 12).map((item: any) => item.id).filter(Boolean);

    if (assetIds.length === 0) {
      return Response.json({ results: [] });
    }

    // Step 2: Fetch thumbnails in batch
    const thumbUrl = `https://thumbnails.roblox.com/v1/assets?assetIds=${assetIds.join(",")}&returnPolicy=PlaceHolder&size=150x150&format=Png&isCircular=false`;
    const thumbRes = await fetch(thumbUrl, { headers: { Accept: "application/json" } });
    const thumbData = thumbRes.ok ? await thumbRes.json() : { data: [] };
    const thumbMap: Record<number, string> = {};
    for (const t of thumbData?.data || []) {
      if (t.targetId && t.imageUrl) {
        thumbMap[t.targetId] = t.imageUrl;
      }
    }

    // Step 3: Fetch asset details (name + creator) in parallel
    const detailPromises = assetIds.map(async (id) => {
      try {
        const detRes = await fetch(`https://economy.roblox.com/v2/assets/${id}/details`, {
          headers: { Accept: "application/json" },
        });
        if (!detRes.ok) return { id, name: `Asset ${id}`, creator: "Unknown" };
        const det = await detRes.json();
        return {
          id,
          name: det.Name || `Asset ${id}`,
          creator: det.Creator?.Name || "Unknown",
        };
      } catch {
        return { id, name: `Asset ${id}`, creator: "Unknown" };
      }
    });

    const details = await Promise.all(detailPromises);

    // Combine everything
    const results = details.map((d) => ({
      id: d.id,
      name: d.name,
      creator: d.creator,
      thumbnail: thumbMap[d.id] || "",
    }));

    return Response.json({ results });
  } catch (err) {
    console.error("Asset search error:", err);
    return Response.json({ results: [], error: "Search failed" });
  }
}
