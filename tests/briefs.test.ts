import { describe, it, expect } from "vitest";
import { normalizeBriefData, extractJSON, extractiveBrief } from "@/lib/briefs";

const article =
  "OpenAI announced GPT-5 on Tuesday. Microsoft will integrate it into Copilot for 400 million users. " +
  "The company said inference costs fell 60% compared with last year. Sam Altman called it a step change.";

const good = {
  _grounding: { numbers: ["400 million", "60%"], names: ["OpenAI", "GPT-5", "Microsoft", "Copilot", "Sam Altman"] },
  summary: "OpenAI launched GPT-5 and Microsoft is shipping it to 400 million Copilot users.",
  key_ideas: ["Inference costs fell 60%", "Copilot reaches 400 million users"],
  entities_topics: ["OpenAI", "Microsoft", "Copilot"],
  why_it_matters: "Distribution beats model quality.",
  opportunity_ideas: ["Watch Copilot pricing"],
  product_opportunity_score: 8,
  recommended_next_action: "Compare GPT-5 pricing to competitors.",
};

describe("normalizeBriefData", () => {
  it("accepts a well-formed brief", () => {
    const b = normalizeBriefData(good, article);
    expect(b.entities_topics).toEqual(["OpenAI", "Microsoft", "Copilot"]);
    expect(b.product_opportunity_score).toBe(8);
  });

  it("drops hallucinated entities that are not in the article", () => {
    const b = normalizeBriefData({ ...good, entities_topics: ["OpenAI", "DALL-E", "Google DeepMind"] }, article);
    expect(b.entities_topics).toEqual(["OpenAI"]);
  });

  it("clamps out-of-range and string scores to 1-10", () => {
    expect(normalizeBriefData({ ...good, product_opportunity_score: 42 }, article).product_opportunity_score).toBe(10);
    expect(normalizeBriefData({ ...good, product_opportunity_score: "-3" }, article).product_opportunity_score).toBe(1);
    expect(normalizeBriefData({ ...good, product_opportunity_score: "7.6" }, article).product_opportunity_score).toBe(8);
  });

  it("coerces a single string where a list was expected", () => {
    const b = normalizeBriefData({ ...good, key_ideas: "Costs fell 60%" }, article);
    expect(b.key_ideas).toEqual(["Costs fell 60%"]);
  });

  it("flattens list items returned as objects instead of rejecting the brief", () => {
    const b = normalizeBriefData(
      { ...good, key_ideas: [{ idea: "Costs fell 60%", detail: "vs last year" }, "Copilot at 400 million"] },
      article
    );
    expect(b.key_ideas).toEqual(["Costs fell 60% — vs last year", "Copilot at 400 million"]);
  });

  it("rejects output with no summary or key ideas", () => {
    expect(() => normalizeBriefData({ ...good, summary: "" }, article)).toThrow();
    expect(() => normalizeBriefData({ ...good, key_ideas: [] }, article)).toThrow();
  });
});

describe("extractJSON", () => {
  it("parses raw, fenced and prose-wrapped JSON", () => {
    expect(extractJSON('{"a":1}')).toEqual({ a: 1 });
    expect(extractJSON('```json\n{"a":2}\n```')).toEqual({ a: 2 });
    expect(extractJSON('Sure! Here it is: {"a":3} Hope that helps.')).toEqual({ a: 3 });
  });

  it("throws when there is no JSON", () => {
    expect(() => extractJSON("I cannot help with that.")).toThrow();
  });
});

describe("extractiveBrief (no-AI fallback)", () => {
  it("only contains text that is verbatim from the article", () => {
    const b = extractiveBrief("GPT-5 launch", article);
    for (const idea of b.key_ideas) expect(article).toContain(idea);
    for (const e of b.entities_topics) expect(article).toContain(e);
    expect(b.key_ideas.some((k) => /\d/.test(k))).toBe(true);
  });
});
