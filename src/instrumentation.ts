export async function register() {
  // Only run on the Node.js runtime (not Edge), and only in production or dev — not during build
  if (process.env.NEXT_RUNTIME === "nodejs" && process.env.NEXT_PHASE !== "phase-production-build") {
    const { seedDefaultSources } = await import("./lib/seed");
    await seedDefaultSources();
  }
}
