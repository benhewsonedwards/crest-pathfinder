// Vercel serverless function — proxies call-prep requests to Anthropic API + Glean MCP
// Server-side: no browser CSP restrictions

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

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
- Modules in scope: ${modules?.length ? modules.join(", ") : "Not yet defined"}
- Integrations mentioned: ${integrations?.length ? integrations.join(", ") : "None captured yet"}
- Notes: ${engagementNotes || "None"}

## Research steps (do all of these)
1. Search Glean for this customer ("${customer}") — look for: Gong call transcripts, Slack messages, emails, Jira tickets, Salesforce notes
2. Search Glean for the CSE_TA_Engagement_Framework document — use its discovery question bank and engagement frameworks for the relevant call type
3. Search Glean for the Onboarding_Kickoff_Framework if this is an onboarding/kickoff call
4. Search the SafetyCulture developer docs and help centre for anything relevant to the integrations or modules in scope
5. Search for any SC GTM materials relevant to this customer's industry or use case

## Key sources to check in Glean
- app:gong — for call recordings and transcripts
- app:salescloud — for account/opportunity data  
- app:slack — for Slack conversation history
- app:confluence — for internal frameworks and playbooks
- app:gdrive — for CSE framework documents

## Output rules
- If customer-specific data IS found: use it directly and cite what you found
- If customer-specific data is NOT found: still produce a full brief using the CSE/TA framework defaults for this call type and stage, SC product knowledge, and any industry context you can infer
- NEVER return an empty brief — a framework-based brief without customer specifics is more useful than nothing
- Write in second person ("you should...", "confirm with them...")

Return ONLY a raw JSON object — no markdown, no backticks, no explanation:
{
  "talkingPoints": ["specific point 1", "specific point 2", ...],
  "criticalQuestions": ["question to ask 1", "question to ask 2", ...],
  "customerMentioned": [{"topic": "SSO", "detail": "based on framework - common for this stage"}],
  "customerContext": "2-3 sentences: what you know about them or what a customer at this stage typically looks like",
  "scDocs": [{"title": "doc title", "url": "url or null", "relevance": "why this matters for this call"}],
  "nextSteps": ["step to confirm on this call 1", "step 2"],
  "previousCallSummary": "summary of last Gong call OR null if none found",
  "dataGapsToFill": ["critical data point not yet captured 1", "data point 2"],
  "whoShouldAttend": ["IT admin for IdP (if SSO)", "CSE + customer project lead"],
  "sourceConfidence": "high|medium|low",
  "sourceSummary": "One sentence: what data was found vs what was inferred from framework"
}`;
}

export default async function handler(req, res) {
  // CORS headers
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  if (!ANTHROPIC_API_KEY) {
    return res.status(500).json({ error: "ANTHROPIC_API_KEY not configured on server" });
  }

  const { taskTitle, stageLabel, customer, engagementNotes, modules, integrations, oppType, planType } = req.body || {};

  if (!customer) {
    return res.status(400).json({ error: "customer is required" });
  }

  const systemPrompt = buildSystemPrompt(taskTitle, stageLabel, customer, engagementNotes, modules, integrations, oppType, planType);

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
        "anthropic-beta": "mcp-client-2025-04-04",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 3000,
        system: systemPrompt,
        messages: [
          {
            role: "user",
            content: `Prepare a call brief for my ${taskTitle} with ${customer}. Search Glean thoroughly for customer history, then use the CSE/TA framework to fill any gaps. Return the JSON brief.`,
          },
        ],
        mcp_servers: [GLEAN_MCP],
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json({ error: data.error?.message || "Anthropic API error" });
    }

    // Extract text blocks
    const textBlocks = (data.content || []).filter((b) => b.type === "text").map((b) => b.text);
    const text = textBlocks.join("\n");

    // Parse JSON from response
    const s = text.indexOf("{");
    const e = text.lastIndexOf("}");
    if (s >= 0 && e >= 0) {
      try {
        const parsed = JSON.parse(text.slice(s, e + 1));
        return res.status(200).json({ result: parsed });
      } catch {
        return res.status(200).json({ result: { raw: text } });
      }
    }

    return res.status(200).json({ result: { raw: text } });
  } catch (err) {
    console.error("Call prep error:", err);
    return res.status(500).json({ error: err.message || "Internal server error" });
  }
}
