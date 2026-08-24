import { NextResponse } from "next/server";

type CommonsPage = {
  title?: string;
  imageinfo?: Array<{
    thumburl?: string;
    descriptionurl?: string;
    mime?: string;
    extmetadata?: Record<string, { value?: string }>;
  }>;
};

function clean(value: string | null, max = 60) {
  return (value || "").replace(/[^a-zA-Z0-9 .&+-]/g, "").trim().slice(0, max);
}

function plainText(value?: string) {
  return (value || "").replace(/<[^>]*>/g, "").replace(/&amp;/g, "&").trim().slice(0, 120);
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const make = clean(url.searchParams.get("make"));
  const model = clean(url.searchParams.get("model"));
  const year = clean(url.searchParams.get("year"), 4);

  if (!make) return NextResponse.json({ image: null }, { status: 400 });

  const search = [year, make, model].filter(Boolean).join(" ") || `${make} automobile`;
  const params = new URLSearchParams({
    action: "query",
    format: "json",
    origin: "*",
    generator: "search",
    gsrsearch: search,
    gsrnamespace: "6",
    gsrlimit: "8",
    prop: "imageinfo",
    iiprop: "url|mime|extmetadata",
    iiurlwidth: "1000",
    iiextmetadatafilter: "Artist|LicenseShortName|LicenseUrl|ObjectName",
  });

  try {
    const response = await fetch(`https://commons.wikimedia.org/w/api.php?${params}`, {
      headers: { "User-Agent": "Mekivo/1.0 (https://mekivo.uk)" },
      next: { revalidate: 86400 },
    });
    if (!response.ok) throw new Error("Commons request failed");
    const payload = await response.json();
    const pages = Object.values(payload?.query?.pages || {}) as CommonsPage[];
    const page = pages.find((item) => {
      const mime = item.imageinfo?.[0]?.mime || "";
      const title = item.title?.toLowerCase() || "";
      return mime.startsWith("image/") && !/(logo|badge|diagram|drawing|interior|engine)/.test(title);
    });
    const info = page?.imageinfo?.[0];
    if (!info?.thumburl) return NextResponse.json({ image: null });

    return NextResponse.json(
      {
        image: {
          url: info.thumburl,
          pageUrl: info.descriptionurl,
          title: plainText(info.extmetadata?.ObjectName?.value) || page?.title?.replace(/^File:/, ""),
          creator: plainText(info.extmetadata?.Artist?.value) || "Wikimedia Commons contributor",
          license: plainText(info.extmetadata?.LicenseShortName?.value) || "View licence",
          licenseUrl: info.extmetadata?.LicenseUrl?.value || info.descriptionurl,
        },
      },
      { headers: { "Cache-Control": "public, s-maxage=86400, stale-while-revalidate=604800" } },
    );
  } catch {
    return NextResponse.json({ image: null }, { status: 502 });
  }
}
