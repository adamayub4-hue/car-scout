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

function safeCommonsUrl(value?: string) {
  if (!value) return null;
  try {
    const url = new URL(value);
    const allowedHost = url.hostname === "upload.wikimedia.org" || url.hostname === "thumb.wikimedia.org";
    const allowedPath = url.pathname.startsWith("/wikipedia/commons/thumb/");
    if (url.protocol !== "https:" || url.port || !allowedHost || !allowedPath) return null;
    url.search = "";
    url.hash = "";
    return url.toString();
  } catch {
    return null;
  }
}

function safeExternalUrl(value?: string) {
  if (!value) return null;
  try {
    const url = new URL(value);
    return (url.protocol === "https:" || url.protocol === "http:") ? url.toString() : null;
  } catch {
    return null;
  }
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const make = clean(url.searchParams.get("make"));
  const model = clean(url.searchParams.get("model"));
  if (!make) return NextResponse.json({ image: null }, { status: 400 });

  const search = model ? `"${make} ${model}" automobile` : `${make} automobile`;
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
    const normalizedMake = make.toLowerCase();
    const normalizedModel = model.toLowerCase();
    const page = pages.find((item) => {
      const mime = item.imageinfo?.[0]?.mime || "";
      const title = item.title?.toLowerCase() || "";
      const objectName = plainText(item.imageinfo?.[0]?.extmetadata?.ObjectName?.value).toLowerCase();
      const searchable = `${title} ${objectName}`;
      return mime.startsWith("image/")
        && searchable.includes(normalizedMake)
        && (!normalizedModel || searchable.includes(normalizedModel))
        && !/(logo|badge|diagram|drawing|interior|engine)/.test(searchable);
    });
    const info = page?.imageinfo?.[0];
    const imageUrl = safeCommonsUrl(info?.thumburl);
    if (!info || !imageUrl) return NextResponse.json({ image: null });
    const pageUrl = safeExternalUrl(info.descriptionurl) || "https://commons.wikimedia.org/";
    const licenseUrl = safeExternalUrl(info.extmetadata?.LicenseUrl?.value) || pageUrl;

    return NextResponse.json(
      {
        image: {
          url: imageUrl,
          pageUrl,
          title: plainText(info.extmetadata?.ObjectName?.value) || page?.title?.replace(/^File:/, ""),
          creator: plainText(info.extmetadata?.Artist?.value) || "Wikimedia Commons contributor",
          license: plainText(info.extmetadata?.LicenseShortName?.value) || "View licence",
          licenseUrl,
        },
      },
      { headers: { "Cache-Control": "public, s-maxage=86400, stale-while-revalidate=604800" } },
    );
  } catch {
    return NextResponse.json({ image: null }, { status: 502 });
  }
}
