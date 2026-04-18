// Vercel serverless function (CommonJS) — proxies call-prep requests to Anthropic + Glean MCP
// Using CommonJS to avoid conflicts with the root package.json "type": "module"

const GLEAN_MCP = {
  type: "url",
  url: "https://safetyculture-be.glean.com/mcp/claude",
  name: "glean",
};

function buildSystemPrompt(taskTitle, stageLabel, customer, engagementNotes, modules, integrations, oppType, planType) {
  return `You are an expert SafetyCulture Customer Success Engineer preparing for a customer call.

Your job is to produce a comprehensive call preparation brief. You MUST always produce a useful brief — even if no customer-specific data exists in Glean, draw on SafetyCulture's CSE/TA engagement framework, GTM methodology, industry knowledge, and the engagement details provided.

## This call
- Customer: ${customer || "Unknown"}
- Call type: ${taskTitle}
- Lifecycle stage: ${stageLabel}
- Plan type: ${planType || "Onboarding"}
- Opportunity type: ${oppType || "Not specified"}
- Modules in scope: ${modules && modules.length ? modules.join(", ") : "Not yet defined"}
- Integrations mentioned: ${integrations && integrations.length ? integrations.join(", ") : "None captured yet"}
- Notes: ${engagementNotes || "None"}

## Research steps (do all of these in order)
1. Search Glean for this customer ("${customer}") — look for: Gong call transcripts, Slack messages, emails, Jira tickets, Salesforce notes. Use app:gong, app:slack, app:salescloud filters.
2. Search Glean for "CSE_TA_Engagement_Framework" — use its discovery question bank and engagement frameworks relevant to this call type.
3. If this is a kickoff or onboarding call, also search for "Onboarding_Kickoff_Framework" in Glean.
4. Search Glean for SafetyCulture developer docs and help centre content relevant to: ${integrations && integrations.length ? integrations.join(", ") : "SSO, API, integrations"}.
5. Search Glean for any SC GTM materials relevant to this customer's industry or use case.

## Critical output rule
- If customer data IS found: use it directly and note what was found.
- If customer data is NOT found: still produce a FULL, DETAILED brief using CSE/TA framework defaults for this call type and stage. A framework-based brief is more useful than nothing.
- NEVER return an empty brief or say you cannot help. Always produce all sections.
- Write in second person ("you should...", "ask them...", "confirm...").

Return ONLY a raw JSON object with no markdown, no backticks, no preamble:
{
  "talkingPoints": ["point 1", "point 2"],
  "criticalQuestions": ["question 1", "question 2"],
  "customerMentioned": [{"topic": "SSO", "detail": "description"}],
  "customerContext": "2-3 sentences about the customer or typical customer at this stage",
  "scDocs": [{"title": "doc title", "url": "url or null", "relevance": "why this matters"}],
  "nextSteps": ["step to confirm on this call"],
  "previousCallSummary": "summary or null",
  "dataGapsToFill": ["critical data point to capture"],
  "whoShouldAttend": ["role that must be on this call"],
  "sourceConfidence": "high|medium|low",
  "sourceSummary": "One sentence: what data was found vs what was inferred from framework"
}`;
}

module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return res.status(500).json({ error: "ANTHROPIC_API_KEY not set on server. Add it in Vercel project settings → Environment Variables." });

  const { taskTitle, stageLabel, customer, engagementNotes, modules, integrations, oppType, planType } = req.body || {};
  if (!customer) return res.status(400).json({ error: "customer is required" });

  const systemPrompt = buildSystemPrompt(taskTitle, stageLabel, customer, engagementNotes, modules, integrations, oppType, planType);

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "anthropic-beta": "mcp-client-2025-04-04",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 3000,
        system: systemPrompt,
        messages: [{
          role: "user",
          content: `Prepare a call brief for my "${taskTitle}" with ${customer}. Search Glean thoroughly for customer history and the CSE/TA framework, then return the JSON brief.`,
        }],
        mcp_servers: [GLEAN_MCP],
      }),
    });

    const data = await response.json();
    if (!response.ok) return res.status(response.status).json({ error: data.error?.message || "Anthropic API error" });

    const text = (data.content || []).filter(b => b.type === "text").map(b => b.text).join("\n");
    const s = text.indexOf("{"), e = text.lastIndexOf("}");
    if (s >= 0 && e >= 0) {
      try {
        return res.status(200).json({ result: JSON.parse(text.slice(s, e + 1)) });
      } catch {
        return res.status(200).json({ result: { raw: text } });
      }
    }
    return res.status(200).json({ result: { raw: text } });

  } catch (err) {
    console.error("Call prep error:", err);
    return res.status(500).json({ error: err.message || "Internal server error" });
  }
};
