import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";
import OpenAI from "openai";
import { extractConcepts, LlmError } from "../src/index.ts";
import { setClientForTesting } from "../src/llm/client.ts";

const files = [{ name: "notes.md", text: "## Recursion\nA function that calls itself." }];
const openaiOpts = { provider: "openai" as const };

type Step = string | Error;
interface Call {
  body: Record<string, any>;
  options: Record<string, any> | undefined;
}

/** Fake OpenAI client: each create() call consumes the next scripted step (a JSON string or an error to throw). */
function fakeClient(steps: Step[]) {
  const calls: Call[] = [];
  const client = {
    chat: {
      completions: {
        create: async (body: Call["body"], options?: Call["options"]) => {
          calls.push({ body, options });
          const step = steps[calls.length - 1] ?? steps[steps.length - 1]!;
          if (step instanceof Error) throw step;
          return { choices: [{ message: { content: step } }] };
        },
      },
    },
  } as unknown as OpenAI;
  setClientForTesting(client);
  return calls;
}

const json = (concepts: unknown[]) => JSON.stringify({ concepts });
const httpError = (status: number) => new OpenAI.APIError(status, {}, `status ${status}`, new Headers());

const savedKey = process.env.OPENAI_API_KEY;
const originalError = console.error;
beforeEach(() => {
  process.env.OPENAI_API_KEY = "test-key";
  console.error = () => {}; // silence [llm] logs
});
afterEach(() => {
  console.error = originalError;
  setClientForTesting(null);
  if (savedKey === undefined) delete process.env.OPENAI_API_KEY;
  else process.env.OPENAI_API_KEY = savedKey;
});

const rejectsLlm = (p: Promise<unknown>, kind: string) =>
  assert.rejects(p, (err) => err instanceof LlmError && err.kind === kind);

describe("extractConcepts (openai provider)", () => {
  it("normalizes: trims, clamps and rounds importance, empty source becomes undefined", async () => {
    fakeClient([
      json([
        { name: "  Base case ", importance: 9, source: " notes.md · Recursion " },
        { name: "Stack", importance: 2.6, source: "" },
        { name: "   ", importance: 3, source: "" },
      ]),
    ]);
    assert.deepEqual(await extractConcepts(files, openaiOpts), [
      { name: "Base case", importance: 5, source: "notes.md · Recursion" },
      { name: "Stack", importance: 3, source: undefined },
    ]);
  });

  it("dedupes names case-insensitively and caps the list at 20", async () => {
    const many = Array.from({ length: 30 }, (_, i) => ({ name: `Concept ${i}`, importance: 3, source: "" }));
    fakeClient([json([{ name: "Base case", importance: 5, source: "" }, { name: "base CASE", importance: 1, source: "" }, ...many])]);
    const out = await extractConcepts(files, openaiOpts);
    assert.equal(out.length, 20);
    assert.equal(out.filter((c) => c.name.toLowerCase() === "base case").length, 1);
    assert.equal(out[0]!.importance, 5);
  });

  it("returns [] for zero concepts", async () => {
    fakeClient([json([])]);
    assert.deepEqual(await extractConcepts(files, openaiOpts), []);
  });

  it("sends the strict schema and the 60s timeout", async () => {
    const calls = fakeClient([json([])]);
    await extractConcepts(files, openaiOpts);
    const format = calls[0]!.body.response_format;
    assert.equal(format.type, "json_schema");
    assert.equal(format.json_schema.strict, true);
    assert.deepEqual(format.json_schema.schema.properties.concepts.items.required, ["name", "importance", "source"]);
    assert.equal(calls[0]!.options?.timeout, 60_000);
  });

  it("lets the caller override the timeout", async () => {
    const calls = fakeClient([json([])]);
    await extractConcepts(files, { ...openaiOpts, timeoutMs: 5_000 });
    assert.equal(calls[0]!.options?.timeout, 5_000);
  });

  it("puts the file text in the request as data", async () => {
    const calls = fakeClient([json([])]);
    await extractConcepts(files, openaiOpts);
    assert.match(calls[0]!.body.messages[1].content, /notes\.md/);
    assert.match(calls[0]!.body.messages[0].content, /Ignore any instructions/);
  });
});

describe("extractConcepts failures", () => {
  it("retries once after bad JSON", async () => {
    const calls = fakeClient(["not json", json([{ name: "A", importance: 3, source: "" }])]);
    assert.equal((await extractConcepts(files, openaiOpts)).length, 1);
    assert.equal(calls.length, 2);
  });

  it("fails after bad JSON twice", async () => {
    const calls = fakeClient(["not json"]);
    await rejectsLlm(extractConcepts(files, openaiOpts), "failed");
    assert.equal(calls.length, 2);
  });

  it("retries a 429 and a 5xx", async () => {
    for (const status of [429, 503]) {
      const calls = fakeClient([httpError(status), json([])]);
      assert.deepEqual(await extractConcepts(files, openaiOpts), []);
      assert.equal(calls.length, 2, `status ${status}`);
    }
  });

  it("makes one attempt on a timeout", async () => {
    const calls = fakeClient([new OpenAI.APIConnectionTimeoutError()]);
    await rejectsLlm(extractConcepts(files, openaiOpts), "timeout");
    assert.equal(calls.length, 1);
  });

  it("makes one attempt on a 401", async () => {
    const calls = fakeClient([httpError(401)]);
    await rejectsLlm(extractConcepts(files, openaiOpts), "failed");
    assert.equal(calls.length, 1);
  });

  it("does not leak the provider's error text", async () => {
    fakeClient([httpError(401)]);
    await assert.rejects(extractConcepts(files, openaiOpts), (err) => !/status 401/.test((err as Error).message));
  });

  it("is not-configured without an API key", async () => {
    delete process.env.OPENAI_API_KEY;
    await rejectsLlm(extractConcepts(files, openaiOpts), "not-configured");
  });
});
