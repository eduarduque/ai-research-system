export const dynamic = "force-dynamic";

function Status({ ok, label }: { ok: boolean; label: string }) {
  return (
    <div className="flex items-center gap-2 text-sm">
      <span className={`w-2 h-2 rounded-full ${ok ? "bg-emerald-400" : "bg-slate-600"}`} />
      <code className="text-slate-300">{label}</code>
      <span className="text-slate-500">{ok ? "configured" : "not set"}</span>
    </div>
  );
}

export default function SlackPage() {
  const steps = [
    { from: "Teammate in Slack", msg: "Shares https://example.com/article in a channel the bot is in" },
    { from: "Slack → App", msg: "POST /api/slack/events (HMAC-signed, verified, retries ignored)" },
    { from: "App", msg: "Ingests the URL, chunks + embeds it, generates a grounded brief" },
    { from: "App → Slack", msg: "Threaded reply: summary, key ideas, why it matters, score, next action" },
  ];

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-bold mb-1">Slack Integration</h1>
      <p className="text-slate-400 text-sm mb-8">
        Drop a link in Slack, get a research brief back in the thread — plus a weekly digest of the top-scored briefs.
      </p>

      <div className="bg-slate-800 rounded-lg p-6 mb-6">
        <h2 className="text-xs font-semibold uppercase tracking-widest text-slate-500 mb-4">Status</h2>
        <div className="space-y-2">
          <Status ok={!!process.env.SLACK_SIGNING_SECRET} label="SLACK_SIGNING_SECRET" />
          <Status ok={!!process.env.SLACK_BOT_TOKEN} label="SLACK_BOT_TOKEN" />
          <Status ok={!!process.env.SLACK_WEBHOOK_URL} label="SLACK_WEBHOOK_URL (weekly digest)" />
        </div>
      </div>

      <div className="bg-slate-800 rounded-lg p-6 mb-6">
        <h2 className="text-xs font-semibold uppercase tracking-widest text-slate-500 mb-4">Flow</h2>
        <div className="space-y-3">
          {steps.map((step, i) => (
            <div key={i} className="flex gap-3 items-start">
              <div className="w-5 h-5 rounded-full bg-slate-700 text-slate-400 text-xs flex items-center justify-center shrink-0 mt-0.5">
                {i + 1}
              </div>
              <div>
                <div className="text-xs text-slate-500 mb-0.5">{step.from}</div>
                <div className="text-sm text-sky-300">{step.msg}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-slate-800 rounded-lg p-6">
        <h2 className="text-xs font-semibold uppercase tracking-widest text-slate-500 mb-3">Setup</h2>
        <ol className="space-y-2 text-sm text-slate-300 list-decimal ml-5">
          <li>Create an app at <code className="bg-slate-700 px-1 rounded">api.slack.com/apps</code> and add the bot scopes <code className="bg-slate-700 px-1 rounded">chat:write</code> and <code className="bg-slate-700 px-1 rounded">channels:history</code>.</li>
          <li>Enable Event Subscriptions with Request URL <code className="bg-slate-700 px-1 rounded">https://your-domain/api/slack/events</code> and subscribe to <code className="bg-slate-700 px-1 rounded">message.channels</code>.</li>
          <li>Set <code className="bg-slate-700 px-1 rounded">SLACK_SIGNING_SECRET</code>, <code className="bg-slate-700 px-1 rounded">SLACK_BOT_TOKEN</code> and <code className="bg-slate-700 px-1 rounded">NEXT_PUBLIC_BASE_URL</code>. Requests are rejected until the signing secret is set.</li>
          <li>Optional: set <code className="bg-slate-700 px-1 rounded">SLACK_WEBHOOK_URL</code> to receive the top 5 briefs every Monday at 8:00.</li>
        </ol>
      </div>
    </div>
  );
}
