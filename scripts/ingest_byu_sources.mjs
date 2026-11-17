import { readFile } from "node:fs/promises";

const sources = JSON.parse(
  await readFile(new URL("../supabase/knowledge/byu_sources.json", import.meta.url), "utf8"),
);

const supabaseUrl = process.env.SUPABASE_URL?.replace(/\/$/, "");
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const geminiApiKey = process.env.GEMINI_API_KEY;
const dryRun = process.argv.includes("--dry-run");
const maxChunkChars = 1800;
const pauseBetweenRequestsMs = 250;
const robotsCache = new Map();
const isByuHost = (hostname) =>
  hostname === "byu.edu" || hostname.endsWith(".byu.edu");
let failedSources = 0;

if (!dryRun && (!supabaseUrl || !serviceRoleKey || !geminiApiKey)) {
  throw new Error(
    "Set SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, and GEMINI_API_KEY before ingesting.",
  );
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const decodeEntities = (text) => text
  .replace(/&#(\d+);/g, (_, value) => String.fromCodePoint(Number(value)))
  .replace(/&#x([\da-f]+);/gi, (_, value) => String.fromCodePoint(parseInt(value, 16)))
  .replace(/&nbsp;/gi, " ")
  .replace(/&amp;/gi, "&")
  .replace(/&lt;/gi, "<")
  .replace(/&gt;/gi, ">")
  .replace(/&quot;/gi, '"')
  .replace(/&#39;|&apos;/gi, "'");

const htmlToText = (html) => decodeEntities(
  html
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<(script|style|noscript|svg|template|header|nav|footer)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, " ")
    .replace(/<(br|hr)\b[^>]*>/gi, "\n")
    .replace(/<\/(p|div|section|article|main|li|h[1-6]|tr|table|ul|ol|blockquote)\s*>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/[\t\f\v ]+/g, " ")
    .replace(/\r/g, "")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim(),
);

const pageTitle = (html, fallback) => {
  const match = html.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i);
  return match ? htmlToText(match[1]).slice(0, 200) || fallback : fallback;
};

const splitIntoChunks = (text) => {
  const paragraphs = text.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);
  const chunks = [];
  let current = "";

  for (const paragraph of paragraphs) {
    if (paragraph.length > maxChunkChars) {
      if (current) chunks.push(current), current = "";
      for (let offset = 0; offset < paragraph.length; offset += maxChunkChars) {
        const part = paragraph.slice(offset, offset + maxChunkChars).trim();
        if (part.length >= 80) chunks.push(part);
      }
      continue;
    }

    if (current && current.length + paragraph.length + 2 > maxChunkChars) {
      chunks.push(current);
      current = paragraph;
    } else {
      current = current ? `${current}\n\n${paragraph}` : paragraph;
    }
  }

  if (current.length >= 80) chunks.push(current);
  return chunks;
};

const getRobotsRules = async (url) => {
  const origin = new URL(url).origin;
  if (robotsCache.has(origin)) return robotsCache.get(origin);

  let rules = [];
  try {
    const response = await fetch(`${origin}/robots.txt`, {
      headers: { "User-Agent": "CougarAI-BYU-InfoBot/1.0 (public information indexing)" },
      signal: AbortSignal.timeout(10000),
    });
    if (response.ok) {
      let appliesToAll = false;
      for (const line of (await response.text()).split(/\r?\n/)) {
        const [rawName, ...rawValue] = line.split(":");
        const name = rawName?.trim().toLowerCase();
        const value = rawValue.join(":").trim();
        if (name === "user-agent") appliesToAll = value === "*";
        else if (name === "disallow" && appliesToAll && value) rules.push(value);
      }
    }
  } catch (error) {
    console.warn(`Could not read robots.txt for ${origin}: ${error.message}`);
  }
  robotsCache.set(origin, rules);
  return rules;
};

const isAllowedByRobots = async (url) => {
  const path = new URL(url).pathname;
  const rules = await getRobotsRules(url);
  return !rules.some((rule) => {
    const escaped = rule.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*");
    return new RegExp(`^${escaped}`).test(path);
  });
};

const sha256 = async (text) => {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
};

const embed = async (text) => {
  const response = await fetch(
    "https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-001:embedContent",
    {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": geminiApiKey },
      body: JSON.stringify({
        model: "models/gemini-embedding-001",
        content: { parts: [{ text }] },
        taskType: "RETRIEVAL_DOCUMENT",
        outputDimensionality: 768,
      }),
      signal: AbortSignal.timeout(30000),
    },
  );
  const result = await response.json();
  if (!response.ok || !Array.isArray(result.embedding?.values)) {
    throw new Error(`Gemini embedding failed (${response.status}): ${JSON.stringify(result)}`);
  }
  return result.embedding.values;
};

const supabaseRequest = async (path, options = {}) => {
  const response = await fetch(`${supabaseUrl}/rest/v1/${path}`, {
    ...options,
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
      "Content-Type": "application/json",
      ...options.headers,
    },
    signal: AbortSignal.timeout(30000),
  });
  if (!response.ok) throw new Error(`Supabase request failed (${response.status}): ${await response.text()}`);
  return response;
};

for (const source of sources) {
  const parsedUrl = new URL(source.url);
  if (parsedUrl.protocol !== "https:") throw new Error(`Source must use HTTPS: ${source.url}`);
  if (!isByuHost(parsedUrl.hostname)) throw new Error(`Source is outside byu.edu: ${source.url}`);
  if (!(await isAllowedByRobots(source.url))) {
    console.warn(`Skipping disallowed URL: ${source.url}`);
    continue;
  }

  try {
    const page = await fetch(source.url, {
      headers: { "User-Agent": "CougarAI-BYU-InfoBot/1.0 (public information indexing)" },
      redirect: "follow",
      signal: AbortSignal.timeout(20000),
    });
    if (!page.ok) throw new Error(`HTTP ${page.status}`);
    const finalUrl = new URL(page.url);
    if (!isByuHost(finalUrl.hostname)) throw new Error(`Redirected outside byu.edu: ${page.url}`);
    if (!(await isAllowedByRobots(page.url))) {
      console.warn(`Skipping disallowed redirect target: ${page.url}`);
      continue;
    }
    const html = await page.text();
    const text = htmlToText(html);
    const chunks = splitIntoChunks(text);
    if (chunks.length === 0) throw new Error("Page did not contain enough extractable text.");

    const title = pageTitle(html, source.title);
    console.log(`${dryRun ? "Would ingest" : "Ingesting"}: ${source.url} (${chunks.length} chunks)`);
    if (dryRun) continue;

    const existingParams = new URLSearchParams({
      select: "chunk_index,content_hash",
      source_url: `eq.${page.url}`,
    });
    const existingResponse = await supabaseRequest(`byu_knowledge_chunks?${existingParams}`);
    const existingRows = await existingResponse.json();
    const existingHashes = new Map(
      existingRows.map((row) => [row.chunk_index, row.content_hash]),
    );

    const rows = [];
    for (let chunkIndex = 0; chunkIndex < chunks.length; chunkIndex++) {
      const content = chunks[chunkIndex];
      const contentHash = await sha256(content);
      if (existingHashes.get(chunkIndex) === contentHash) continue;
      rows.push({
        source_url: page.url,
        source_title: title,
        chunk_index: chunkIndex,
        content,
        content_hash: contentHash,
        embedding: await embed(content),
        fetched_at: new Date().toISOString(),
      });
      await sleep(pauseBetweenRequestsMs);
    }

    if (rows.length) {
      await supabaseRequest(
        "byu_knowledge_chunks?on_conflict=source_url,chunk_index",
        {
          method: "POST",
          headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
          body: JSON.stringify(rows),
        },
      );
    }

    const deleteParams = new URLSearchParams({
      source_url: `eq.${page.url}`,
      chunk_index: `gte.${chunks.length}`,
    });
    await supabaseRequest(`byu_knowledge_chunks?${deleteParams}`, { method: "DELETE" });
  } catch (error) {
    failedSources++;
    console.error(`Failed to ingest ${source.url}: ${error.message}`);
  }

  await sleep(1000);
}

console.log(dryRun ? "Dry run complete; no data was written." : `Ingestion complete with ${failedSources} failed source(s).`);
if (failedSources) process.exitCode = 1;
