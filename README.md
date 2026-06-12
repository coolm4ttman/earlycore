# EarlyCore — Wiz for agents

Real-time security for AI agents in production. EarlyCore watches an agent
environment agentlessly, red-teams it pre-production, intercepts live attacks
at the gateway before data leaves, correlates everything into a **cross-layer
attack graph**, severs the attack path autonomously — no human in the loop —
and emits auditor-ready compliance evidence from what actually happened.

```
            ┌─────────────────────────────────────────────────────────┐
            │                      EARLYCORE LOOP                     │
            │                                                         │
   logs ───▶│  SEE ──▶ STOP ──────▶ TRACE ─────▶ FIX ─────▶ PROVE     │
  traces    │  agentless  red team +   cross-layer   autonomous   live │
  telemetry │  ingestion  runtime      attack graph  sever +      scores
            │             interception  (the moat)   replay-proof  + evidence
            └─────────────────────────────────────────────────────────┘
```

- **SEE** — agentless ingestion: EarlyCore reads the target's existing
  telemetry (API-gateway access logs, LangChain traces; LogFire/Bedrock
  adapters stubbed) — zero code changes to the agent.
- **STOP (pre-prod)** — red team via [Promptfoo](https://github.com/promptfoo/promptfoo)'s
  OSS engine: 22 scanners across the OWASP agentic surface
  ([config](config/promptfooconfig.yaml)), plus offline live probes that attack
  the real agent over HTTP and grade its real responses deterministically.
- **STOP (runtime)** — an interception gateway proxies live traffic and
  inspects every exchange **before the response is released**, flagging
  injected instructions and PII pre-exfiltration.
- **TRACE** — findings + topology become a cross-layer attack graph
  (`agent | tool | cloud | data | gpu`). Paths are **computed** from the nodes an
  attack was really observed to touch — never hardcoded, and a layer only
  lights up if a real signal put it on the path.
- **FIX** — a landed finding deterministically triggers an autonomous action
  (`block_call` / `revoke_tool` / `jira_ticket` / `slack_alert`) with no
  approval step. Block/revoke write real gateway policy; then `simulate`
  **replays the original attack** and proves it's now blocked. The path goes
  grey on the graph.
- **PROVE** — live compliance scores for GDPR, SOC 2, ISO 42001, NIST AI RMF,
  EU AI Act, IEEE 7000 — a transparent scoring function over real findings and
  actions (every score ships its per-finding deductions) — plus Senso-grounded
  clause mappings bundled into an auditor pack.

**Honest line:** Promptfoo is the OSS red-team foundation; EarlyCore is the
cross-layer correlation + autonomy + evidence layer on top.

## Quickstart

```bash
npm install
(cd ui/web && npm install && npm run build)   # build the platform UI once
cp .env.example .env          # all keys optional; everything degrades honestly

docker compose up -d          # ClickHouse + Langfuse (optional)
npm run target                # terminal 1 — the deliberately leaky support agent
npm run ui                    # terminal 2 — platform http://localhost:4000
```

Click **Run autonomy loop** in the header (or `npm run demo` /
`curl -X POST localhost:4000/api/run`) and watch: real injections land against
the real agent, the attack path lights up across layers on the Attack Graph
page, EarlyCore severs it autonomously, and the replay proves the chain is
closed. Issues, Alerts & Policies, and the compliance gauges all populate from
the same live run. UI development: `npm run web:dev` (Vite, proxies /api).

More:

```bash
npm run demo:stub             # spine only — no agent, no keys, deterministic
npm run redteam               # full Promptfoo 22-scanner run (needs OPENAI_API_KEY)
npm run demo:promptfoo        # loop driven by parsed Promptfoo findings
                              # (set EARLYCORE_RESULTS_FILE to reuse a results JSON)
npm run gateway               # standalone interception proxy on :4200
```

> Promptfoo notes: `promptfoo@latest` requires Node ≥ 22.22 — on older Node the
> scripts pin `promptfoo@0.120.27`. Red-team generation uses promptfoo's remote
> service: run `npx promptfoo@0.120.27 config set email <you>` once, and keep
> the `--remote` flag (already in `npm run redteam`) since remote generation
> auto-disables when `OPENAI_API_KEY` is set.

## What's real vs stubbed

Everything the demo shows is something the code actually does. The default
offline run uses **real HTTP attacks against the real vulnerable agent** with
deterministic graders, **real gateway interception**, **real policy
enforcement**, and **real replay verification**. Where a sponsor key is absent
the integration degrades to a clearly marked stub (`grep -r "TODO(sponsor)"`),
and the output labels itself `(stub)` — nothing pretends.

| Tool | Role | Without a key |
|---|---|---|
| **Promptfoo** (OSS foundation) | 22-scanner pre-prod red team (`npm run redteam`) | offline live probes attack the agent instead |
| **Senso** | clause grounding via `senso search` + **cited.md evidence publishing** after every run (the submission-verification artifact) + KB/GEO via the onboarding flow | marked fallback clause set; cited.md still generated locally |
| **Thesys C1** | the Ask EarlyCore page — generative-UI answers over the real session state | page reports the missing key; no mocked AI |
| **Composio** | autonomous Slack/Jira actions (requires connected accounts in the Composio dashboard) | marked stub; block/revoke still enforce locally |
| **ClickHouse** | `agent_events` store | in-memory store |
| **Langfuse** | traces per loop stage (`earlycore.*`) | console tracer |
| **Pioneer** | inference endpoint for red-team generation | OpenAI default |
| **OpenUI** | C1's rendering layer (`openui-lang`) + shadcn panels on the same SSE contract | — |

## The cross-layer attack graph

Nodes live in layers (`agent | tool | cloud | data | gpu`) with
`trust` and `sensitivity`; edges are typed relations
(`can_invoke | can_reach | ingests | calls_agent | runs_on | reads_from`).
An attack path is a chain from an `untrusted` ingestion point to a `sensitive`
sink **that a real finding traversed**: the graph routes only through nodes the
attack was observed to touch (tool calls in the agent's own telemetry), so the
demo's `s3_logs` and `inference_gpu` nodes stay unlit unless something real
reaches them. Path severity = max finding severity on the path.

## Security-correctness calls (flagged for review)

1. **Autonomous blocking policy** ([src/remediate/index.ts](src/remediate/index.ts)):
   PII/critical → `block_call`, excessive-agency/BFLA/BOLA → `revoke_tool`,
   executed with no human approval. That's the demo's point, but the
   aggressiveness threshold is a product decision.
2. **Enforcement point**: block/revoke are enforced at the interception
   gateway (pre-exfiltration), not inside the agent — agentless by design. The
   agent may still act internally; what's guaranteed is that nothing crosses
   the boundary.
3. **Policy reset per run** ([src/orchestrator.ts](src/orchestrator.ts)): each
   demo run clears enforcement rules so the open→sever→verified arc is visible.
   Production would persist policy.
4. **Compliance scoring residuals** ([src/compliance/index.ts](src/compliance/index.ts)):
   verified-closed findings retain 20% of their deduction (the gap existed);
   unverified remediations retain 50%. Transparent but debatable weights.

## Repo map

```
demo/topology.ts            seeded cross-layer environment (the target)
demo/vulnerable-agent.ts    genuinely leaky support agent (HTTP)
config/promptfooconfig.yaml 22-scanner red-team config
src/orchestrator.ts         SEE→STOP→TRACE→FIX→PROVE autonomy loop
src/ingest/                 SEE: agentless adapters (api-gateway, langchain real; logfire, bedrock stubs)
src/redteam/                STOP: promptfoo wrapper + offline live probes
src/runtime/                STOP: interception gateway + enforcement policy
src/graph/                  TRACE: cross-layer graph + path computation
src/remediate/  src/simulate/  FIX: autonomous action + replay proof
src/compliance/ src/evidence/  PROVE: live scores + Senso clause grounding + auditor pack
src/findings/               lifecycle: P0–P3, status, owner, Jira sync
src/store/                  ClickHouse events + Langfuse traces
src/publish/cited.ts        parked: cited.md publishing via Senso (needs creds)
ui/server.ts                serves the web app + SSE stream (+ in-process run)
ui/web/                     the platform UI: React + shadcn/ui (light, Inter)
                            Dashboard · Agents · Issues (+ detail w/ attack
                            path) · Alerts & Policies · Attack Graph
```

## Deploy

[render.yaml](render.yaml) deploys the UI (public) and the target agent
(private service). Set sponsor keys in the Render dashboard — secrets live in
env only, never in this repo.
