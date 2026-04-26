import { NextRequest } from "next/server";

// Roblox Catalog API search
export async function GET(req: NextRequest) {
  const query = req.nextUrl.searchParams.get("q") || "";
  const category = req.nextUrl.searchParams.get("category") || "Models";
  
  if (!query.trim()) {
    return Response.json({ results: [] });
  }

  try {
    // Search the Roblox catalog/toolbox
    const searchUrl = `https://apis.roblox.com/toolbox-service/v1/marketplace/${encodeURIComponent(category.toLowerCase())}?keyword=${encodeURIComponent(query)}&num=12&sortType=Relevance&includeOnlyVerifiedCreators=false`;
    
    const res = await fetch(searchUrl, {
      headers: {
        "Accept": "application/json",
      },
    });

    if (!res.ok) {
      // Fallback: try the legacy search endpoint
      const legacyUrl = `https://search.roblox.com/catalog/json?Category=${encodeURIComponent(category)}&Keyword=${encodeURIComponent(query)}&ResultsPerPage=12`;
      const legacyRes = await fetch(legacyUrl);
      if (!legacyRes.ok) {
        return Response.json({ results: [], error: "Search failed" });
      }
      const legacyData = await legacyRes.json();
      const results = (legacyData || []).map((item: any) => ({
        id: item.AssetId || item.id,
        name: item.Name || item.name || "Unnamed",
        creator: item.Creator?.Name || item.creator || "Unknown",
        thumbnail: `https://thumbnails.roblox.com/v1/assets?assetIds=${item.AssetId || item.id}&size=150x150&format=Png`,
        price: item.Price || 0,
      }));
      return Response.json({ results });
    }

    const data = await res.json();
    const rawResults = data?.data || data?.results || [];
    
    const results = rawResults.slice(0, 12).map((item: any) => ({
      id: item.asset?.id || item.id || 0,
      name: item.asset?.name || item.name || "Unnamed",
      creator: item.creator?.name || item.creatorName || "Unknown",
      thumbnail: item.asset?.id 
        ? `https://thumbnails.roblox.com/v1/assets?assetIds=${item.asset.id}&returnPolicy=PlaceHolder&size=150x150&format=Png&isCircular=false`
        : "",
      price: item.product?.price || 0,
    }));

    return Response.json({ results });
  } catch (err) {
    console.error("Asset search error:", err);
    return Response.json({ results: [], error: "Search failed" });
  }
}
