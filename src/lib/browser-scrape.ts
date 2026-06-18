import puppeteer from "puppeteer-core";

const CHROME_PATH = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";

export async function scrapeWithBrowser(
  url: string
): Promise<{ title: string; content: string } | null> {
  let browser;
  try {
    browser = await puppeteer.launch({
      executablePath: CHROME_PATH,
      // headless: false looks like a real user — some sites (openai.com) block
      // headless:true even with stealth flags, so we use visible Chrome briefly
      headless: false,
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-gpu",
        "--window-size=1280,800",
        // Prevents sites from detecting automated Chrome via Blink feature flags
        "--disable-blink-features=AutomationControlled",
      ],
    });

    const page = await browser.newPage();

    // Hide the navigator.webdriver property that sites check for bot detection
    await page.evaluateOnNewDocument(() => {
      Object.defineProperty(navigator, "webdriver", { get: () => undefined });
    });

    await page.setUserAgent(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
    );

    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 25000 });

    // Give JS-rendered content time to paint
    await new Promise((r) => setTimeout(r, 3000));

    const result = await page.evaluate(() => {
      document
        .querySelectorAll("script,style,nav,footer,header,iframe,[role='navigation']")
        .forEach((el) => el.remove());

      return {
        title: document.title.trim(),
        content: (document.body.innerText || "").trim(),
      };
    });

    return result.content.length > 100 ? result : null;
  } catch (err) {
    console.warn("Browser scrape failed:", err instanceof Error ? err.message : err);
    return null;
  } finally {
    await browser?.close();
  }
}
