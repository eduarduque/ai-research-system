import fs from "fs";
import { assertPublicUrl } from "./url";

const CANDIDATE_PATHS = [
  process.env.CHROME_PATH,
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/usr/bin/chromium",
  "/usr/bin/chromium-browser",
  "/usr/bin/google-chrome",
  "/usr/bin/google-chrome-stable",
];

export function findChrome(): string | null {
  for (const p of CANDIDATE_PATHS) if (p && fs.existsSync(/*turbopackIgnore: true*/ p)) return p;
  return null;
}

/**
 * Render a JavaScript-heavy page in headless Chrome/Chromium and return its text.
 * Optional: returns null when no browser is installed or BROWSER_SCRAPE=false, and
 * the caller falls back to whatever static extraction produced.
 */
export async function scrapeWithBrowser(url: string): Promise<{ title: string; content: string } | null> {
  if (process.env.BROWSER_SCRAPE === "false") return null;
  const executablePath = findChrome();
  if (!executablePath) return null;

  const puppeteer = (await import("puppeteer-core")).default;
  let browser;
  try {
    browser = await puppeteer.launch({
      executablePath,
      headless: true,
      // --no-sandbox is required when running as root in containers.
      args: ["--no-sandbox", "--disable-gpu", "--disable-dev-shm-usage"],
    });
    const page = await browser.newPage();

    // Block navigations/subrequests to internal addresses (SSRF via in-page redirects).
    await page.setRequestInterception(true);
    page.on("request", (req) => {
      assertPublicUrl(req.url())
        .then(() => req.continue())
        .catch(() => req.abort("blockedbyclient"));
    });

    await page.goto(url, { waitUntil: "networkidle2", timeout: 25000 });
    const result = await page.evaluate(() => {
      document.querySelectorAll("script,style,nav,footer,header,iframe,[role='navigation']").forEach((el) => el.remove());
      return { title: document.title.trim(), content: (document.body.innerText || "").trim() };
    });
    return result.content.length > 100 ? result : null;
  } catch (err) {
    console.warn("Browser scrape failed:", err instanceof Error ? err.message : err);
    return null;
  } finally {
    await browser?.close();
  }
}
