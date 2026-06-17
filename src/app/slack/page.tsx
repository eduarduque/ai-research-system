export default function SlackPage() {
  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-bold mb-1">Slack Integration</h1>
      <p className="text-slate-400 text-sm mb-8">
        Stub documentation and API endpoint for the <code className="bg-slate-700 px-1 rounded">/research</code> Slack command.
      </p>

      {/* Command Flow */}
      <div className="bg-slate-800 rounded-lg p-6 mb-6">
        <h2 className="text-xs font-semibold uppercase tracking-widest text-slate-500 mb-4">Command Flow</h2>
        <div className="space-y-3">
          {[
            { from: "User in Slack", msg: "/research https://example.com/article" },
            { from: "Slack → App", msg: "POST /api/slack/research  { url: 'https://example.com/article' }" },
            { from: "App", msg: "Ingests URL, generates brief, saves to library" },
            { from: "App → Slack", msg: "Research item received. View it in the dashboard at /library." },
          ].map((step, i) => (
            <div key={i} className="flex gap-3 items-start">
              <div className="w-5 h-5 rounded-full bg-slate-700 text-slate-400 text-xs flex items-center justify-center shrink-0 mt-0.5">
                {i + 1}
              </div>
              <div>
                <div className="text-xs text-slate-500 mb-0.5">{step.from}</div>
                <code className="text-sm text-sky-300 font-mono">{step.msg}</code>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* API Endpoint */}
      <div className="bg-slate-800 rounded-lg p-6 mb-6">
        <h2 className="text-xs font-semibold uppercase tracking-widest text-slate-500 mb-4">Stub API Endpoint</h2>
        <div className="space-y-2 text-sm font-mono">
          <div><span className="text-emerald-400">POST</span> <span className="text-slate-300">/api/slack/research</span></div>
          <div className="text-slate-500">Content-Type: application/json</div>
          <pre className="bg-slate-900 rounded p-3 text-xs text-slate-300 mt-2">
{`{
  "url": "https://example.com/article"
}

// Response:
{
  "response_type": "in_channel",
  "text": "Research item received. View it in the dashboard at /library."
}`}
          </pre>
        </div>
      </div>

      {/* Setup Instructions */}
      <div className="bg-slate-800 rounded-lg p-6">
        <h2 className="text-xs font-semibold uppercase tracking-widest text-slate-500 mb-4">
          To Wire Up a Real Slack Bot
        </h2>
        <ol className="space-y-2 text-sm text-slate-300 list-decimal list-inside">
          <li>Create a Slack app at <span className="text-sky-400">api.slack.com/apps</span></li>
          <li>Add a Slash Command: <code className="bg-slate-700 px-1 rounded">/research</code> → Request URL: <code className="bg-slate-700 px-1 rounded">{`https://your-domain/api/slack/research`}</code></li>
          <li>Add <code className="bg-slate-700 px-1 rounded">SLACK_BOT_TOKEN</code> and <code className="bg-slate-700 px-1 rounded">SLACK_SIGNING_SECRET</code> to <code className="bg-slate-700 px-1 rounded">.env.local</code></li>
          <li>Install <code className="bg-slate-700 px-1 rounded">@slack/bolt</code> and verify the request signature in the route handler</li>
          <li>Call <code className="bg-slate-700 px-1 rounded">/api/ingest/url</code> internally then post back to Slack</li>
        </ol>
      </div>
    </div>
  );
}
