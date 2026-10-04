type ShareBrowser = {
  share?: (data: { title: string; url: string }) => Promise<void>;
  clipboard?: { writeText: (value: string) => Promise<void> };
};

export async function shareSearchLink(url: string, title: string, browser: ShareBrowser): Promise<"shared" | "copied" | "cancelled"> {
  if (typeof browser.share === "function") {
    try {
      await browser.share({ title, url });
      return "shared";
    } catch (error) {
      if (error && typeof error === "object" && "name" in error && error.name === "AbortError") return "cancelled";
      // A denied or unavailable share sheet can still use the copy fallback.
    }
  }
  if (typeof browser.clipboard?.writeText !== "function") throw new Error("Clipboard unavailable");
  await browser.clipboard.writeText(url);
  return "copied";
}
