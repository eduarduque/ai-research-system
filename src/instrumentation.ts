declare global {
  var __slackCronRegistered: boolean | undefined;
}

export async function register() {
  if (
    process.env.NEXT_RUNTIME === "nodejs" &&
    process.env.NEXT_PHASE !== "phase-production-build"
  ) {
    // Seed + backfill in the background: first-boot embedding model download and
    // feed fetching must never delay the server from accepting requests.
    const { seedAndBackfill } = await import("./lib/seed");
    void seedAndBackfill();

    // Weekly Slack digest — Mondays at 8:00 AM
    if (process.env.SLACK_WEBHOOK_URL && !global.__slackCronRegistered) {
      global.__slackCronRegistered = true;
      const cron = await import("node-cron");
      const { getBriefs } = await import("./lib/db");

      cron.schedule("0 8 * * 1", async () => {
        const webhookUrl = process.env.SLACK_WEBHOOK_URL!;
        const base = process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:3000";

        const oneWeekAgo = new Date(
          Date.now() - 7 * 24 * 60 * 60 * 1000
        ).toISOString();

        type BriefRow = {
          id: string;
          source_id: string;
          summary: string;
          why_it_matters: string;
          product_opportunity_score: number;
          recommended_next_action: string;
          source_title: string;
          source_url: string;
          created_at: string;
        };

        const weekBriefs = (getBriefs() as BriefRow[])
          .filter((b) => b.created_at >= oneWeekAgo)
          .sort((a, b) => b.product_opportunity_score - a.product_opportunity_score)
          .slice(0, 5);

        if (weekBriefs.length === 0) {
          console.log("Weekly digest: no new briefs this week, skipping.");
          return;
        }

        const weekStr = new Date().toLocaleDateString("en-US", {
          month: "long",
          day: "numeric",
          year: "numeric",
        });

        const items = weekBriefs
          .map(
            (b, i) =>
              [
                `*${i + 1}. ${b.source_title}* — Score: ${b.product_opportunity_score}/10`,
                b.source_url,
                b.summary,
                `_Why it matters:_ ${b.why_it_matters}`,
                `_Next:_ ${b.recommended_next_action}`,
                `_Full brief:_ ${base}/briefs/${b.id}`,
              ].join("\n")
          )
          .join("\n\n---\n\n");

        const text = `📊 *Weekly Research Digest — Week of ${weekStr}*\n\n${items}`;

        await fetch(webhookUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text }),
        });

        console.log(`Weekly Slack digest sent — ${weekBriefs.length} briefs.`);
      });

      console.log("✅ Weekly Slack digest scheduled (Mondays at 8:00 AM)");
    }
  }
}
