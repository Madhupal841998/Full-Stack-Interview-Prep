# Phase 19 — Observability and Production Operations

> Priority: **MUST KNOW**
> Prerequisite: Phase 13 (Error Handling and Resilience) — observability is how you find out those failure modes are actually happening.

Each topic below follows the standard learning order: definition → simple meaning → why it's needed → internals → syntax/API → example → real backend usage → edge cases → common mistakes → interview answer → practice problem → production considerations.

---

## 19.1 Logs

**Definition.** A log is a timestamped, discrete record of something that happened in the system — a request, an error, a state change.

**Why it's needed.** Logs are the lowest-level, most detailed observability signal. When metrics say "error rate spiked" and traces say "which request," logs answer "what exactly went wrong, with what data."

**How it works internally.** Structured logging emits each entry as JSON (not a free-text sentence), so log fields (level, message, requestId, userId, durationMs) are queryable by a log aggregator (CloudWatch Logs, ELK, Loki) instead of relying on regex over strings.

**Syntax / API.**
```javascript
const pino = require('pino')

const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  formatters: {
    level: (label) => ({ level: label })
  }
})

logger.info({ requestId: req.id, userId: req.user?.id, path: req.path }, 'request completed')
logger.error({ requestId: req.id, err }, 'failed to create session')
```

**Real backend usage.** Every request logged once at completion with method, path, status, duration, and `requestId`; every caught error logged with the same `requestId` so a support ticket ("my upload failed at 3:14pm") can be traced to one log line and its surrounding context.

**Edge cases.**
- Logging full request/response bodies can leak PII (passwords, tokens, learner personal data) into log storage.
- Extremely high log volume (debug-level logging left on in production) increases cost and can throttle the aggregator.
- Log levels must be consistent across services, or `warn` in one service means something different from `warn` in another.

**Common mistakes.**
- Logging unstructured strings (`console.log('user ' + id + ' failed')`) that can't be filtered or aggregated reliably.
- Not including a correlation ID, making it impossible to connect a log line back to a specific request.
- Logging sensitive fields (passwords, tokens, full card numbers) directly.

**Interview answer.** "Structured, leveled logs with a correlation ID are the base layer of observability. They're for the specific 'what happened in this one request' question, complementing metrics (aggregate trends) and traces (cross-service timing)."

**Practice problem.** Add a request-scoped logger (via middleware) that automatically includes `requestId` and `userId` in every log line for that request, without repeating them at every call site.

**Production considerations.** Redact or omit sensitive fields at the logging layer itself (a serializer/formatter), not by trusting every call site to remember; ship logs to a centralized store with retention policy, not just stdout on the instance.

---

## 19.2 Metrics

**Definition.** A metric is a numeric measurement aggregated over time — a count, a gauge, or a distribution — used to see trends and trigger alerts.

**Why it's needed.** Logs don't scale for answering "is the system healthy right now" across millions of requests; metrics compress that into a handful of numbers you can graph and alert on.

**How it works internally.** An in-process metrics client (e.g., `prom-client`) keeps counters/histograms in memory; a `/metrics` endpoint exposes them in a format a scraper (Prometheus) polls periodically, or the app pushes them to a managed service (CloudWatch Metrics, Datadog).

**Syntax / API.**
```javascript
const client = require('prom-client')

const httpRequestDuration = new client.Histogram({
  name: 'http_request_duration_seconds',
  help: 'HTTP request duration in seconds',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.05, 0.1, 0.3, 0.5, 1, 2, 5]
})

const trackDuration = (req, res, next) => {
  const end = httpRequestDuration.startTimer()
  res.on('finish', () => {
    end({ method: req.method, route: req.route?.path || 'unknown', status_code: res.statusCode })
  })
  next()
}

app.get('/metrics', async (req, res) => {
  res.set('Content-Type', client.register.contentType)
  res.end(await client.register.metrics())
})
```

**Real backend usage.** Request rate, error rate, and latency histograms per route; a gauge for active DB connections in the pool; a counter for background jobs processed vs failed.

**Edge cases.**
- High-cardinality labels (e.g., using raw `userId` as a label) can explode the number of time series and blow up storage/cost.
- Histograms need well-chosen buckets — buckets that don't bracket real latencies make percentile calculations meaningless.
- Metrics reset on process restart unless the aggregation backend persists them.

**Common mistakes.**
- Using a label with unbounded cardinality (user ID, request ID) instead of bounded ones (route, status code, method).
- Only tracking averages, hiding tail latency (a slow p99 can be invisible in an average).
- No metric on background jobs/queues, leaving async failures invisible until logs are searched manually.

**Interview answer.** "Metrics are aggregated numeric time series — counters, gauges, histograms — cheap to store and graph at scale, which is why they're the backbone of alerting, while logs and traces are what you drill into once a metric tells you something's wrong."

**Practice problem.** Add a counter for background job outcomes (`jobs_processed_total{status="success|failed"}`) and a histogram for job duration, and expose both on `/metrics`.

**Production considerations.** Keep label cardinality bounded; separate business metrics (signups, payments) from infrastructure metrics (latency, memory) so both are visible without one drowning out the other.

---

## 19.3 Traces and Correlation IDs

**Definition.** A trace follows a single request across every service/function it touches, broken into "spans" that record where time was spent; a correlation ID is the single identifier tying all logs, metrics, and spans for that request together.

**Why it's needed.** In a system with multiple services (or even multiple layers — controller → service → repository → external API), a slow or failing request needs to be broken down by which hop was slow, not just "the request took 2 seconds."

**How it works internally.** A correlation ID is generated (or read from an incoming header like `x-request-id`) at the edge and propagated through every downstream call (HTTP headers, queue message metadata). A tracer (OpenTelemetry) wraps operations in spans with start/end timestamps and attaches the same trace ID across service boundaries, visualized as a waterfall in a tool like Jaeger or X-Ray.

**Syntax / API.**
```javascript
const { v4: uuidv4 } = require('uuid')

const attachRequestId = (req, res, next) => {
  req.id = req.headers['x-request-id'] || uuidv4()
  res.set('x-request-id', req.id)
  next()
}
```
```javascript
const { trace } = require('@opentelemetry/api')

const tracer = trace.getTracer('lms-api')

const getSessionWithMaterials = async (sessionId) => {
  return tracer.startActiveSpan('getSessionWithMaterials', async (span) => {
    try {
      const session = await sessionRepository.findById(sessionId)
      const materials = await materialRepository.findBySession(sessionId)
      return { ...session, materials }
    } finally {
      span.end()
    }
  })
}
```

**Real backend usage.** `x-request-id` generated at the API gateway/edge, passed through every internal service call and into the message a background worker picks up, so a single trace shows: API → auth check → DB query → S3 call → response, with per-hop timing.

**Edge cases.**
- If the ID isn't propagated into async work (queue jobs, `setTimeout` callbacks), the trace breaks at that boundary.
- Tracing every request in a high-traffic system is expensive — sampling (trace 1% of requests, or 100% of slow/error ones) is usually necessary.
- Clock differences between services can make span ordering look wrong even when propagation is correct.

**Common mistakes.**
- Generating a new ID at every layer instead of propagating the one from the edge.
- Not including the correlation ID in error logs, so a trace and its logs can't be cross-referenced.
- Tracing added only after an incident, instead of being there before it's needed.

**Interview answer.** "A correlation ID ties logs, metrics context, and trace spans for one request together across every service boundary it crosses. Tracing then breaks that request into spans so you can see exactly which downstream call — DB, cache, external API — accounted for the latency."

**Practice problem.** Add request-ID propagation from an incoming HTTP request into a background job payload, and include that same ID in every log line the worker emits while processing it.

**Production considerations.** Sample traces intelligently (always keep errors and slow requests, sample the rest) to control cost while keeping the signal that actually matters.

---

## 19.4 Core Signals: Latency, Error Rate, Throughput, Saturation

**Definition.** The four measurements that describe a service's health from the outside: latency (how long requests take), error rate (fraction failing), throughput (requests per second), and saturation (how full a resource — CPU, memory, connection pool, queue — currently is).

**Why it's needed.** These four numbers, tracked per service, catch the overwhelming majority of production problems before a human notices from complaints.

**How it works internally.** Latency and error rate come from instrumenting the HTTP layer (the histogram/counter shown in 19.2); throughput is a rate derived from the request counter; saturation comes from resource-specific gauges (DB pool `used/total`, event loop lag, memory usage).

**Syntax / API.**
```javascript
const poolSaturation = new client.Gauge({
  name: 'db_pool_connections_in_use',
  help: 'Active MySQL connections in use',
  collect() {
    this.set(dbPool.pool._allConnections.length - dbPool.pool._freeConnections.length)
  }
})

const eventLoopLag = new client.Gauge({
  name: 'nodejs_event_loop_lag_seconds',
  help: 'Event loop lag in seconds'
})

setInterval(() => {
  const start = process.hrtime.bigint()
  setImmediate(() => {
    const lagNs = Number(process.hrtime.bigint() - start)
    eventLoopLag.set(lagNs / 1e9)
  })
}, 5000)
```

**Real backend usage.** A dashboard per service showing p50/p95/p99 latency, error rate as a percentage of total requests, requests/sec, and DB pool saturation — the first thing checked during an incident.

**Edge cases.**
- Latency should always be looked at as percentiles (p95, p99), never just an average, since averages hide the slow tail that actually hurts users.
- Error rate as a raw count is misleading without throughput context — 50 errors out of 100 requests is very different from 50 out of 100,000.
- Saturation on one resource (e.g., DB connections) can cause latency/errors elsewhere (request queue backing up) without that resource itself showing an obvious error.

**Common mistakes.**
- Alerting on raw error count instead of error rate (percentage), causing false alarms during low-traffic periods and missed alarms during high-traffic ones.
- Only measuring latency at the load balancer, missing where time is actually spent internally.
- No saturation metrics at all, so the system degrades with no early warning before it fails outright.

**Interview answer.** "Latency, error rate, throughput, and saturation are the four signals that describe service health from the outside. Tracking them per-service, with latency as percentiles and error rate as a ratio, catches most production issues before they become outages."

**Practice problem.** Instrument an API to expose p50/p95/p99 latency, error rate, requests/sec, and DB pool saturation, then intentionally saturate the DB pool and observe which signal moves first.

**Production considerations.** Set alert thresholds based on these four signals specifically — they're the ones with the best signal-to-noise ratio for catching real incidents early.

---

## 19.5 RED Method and USE Method

**Definition.** RED (Rate, Errors, Duration) is a framework for monitoring request-driven services; USE (Utilization, Saturation, Errors) is a framework for monitoring resources (CPU, memory, disk, connection pools).

**Why it's needed.** Without a framework, teams end up with inconsistent, ad hoc dashboards where every service is monitored differently. RED/USE give a repeatable checklist so nothing critical is missed.

**How it works internally.** RED maps directly onto per-endpoint metrics: Rate = requests/sec, Errors = error rate, Duration = latency distribution. USE maps onto infrastructure metrics: Utilization = percent of capacity in use, Saturation = queued/waiting work beyond capacity, Errors = resource-level errors (disk I/O errors, OOM kills).

**Syntax / API.**
```text
RED (per service/endpoint):
  Rate     -> http_requests_total (rate over 1m)
  Errors   -> http_requests_total{status_code=~"5.."} / http_requests_total
  Duration -> http_request_duration_seconds (p50/p95/p99)

USE (per resource):
  Utilization -> cpu_usage_percent, memory_usage_percent
  Saturation  -> db_pool_connections_in_use / db_pool_max, queue_depth
  Errors      -> disk_io_errors_total, oom_kill_total
```

**Real backend usage.** Each new service ships with a RED dashboard by default (rate, error %, p95 latency per route); infrastructure dashboards (DB, Redis, EC2/ECS) follow USE, so an on-call engineer knows exactly where to look regardless of which service is paging.

**Edge cases.**
- RED fits request-driven services well but doesn't directly apply to batch/background jobs — those need job-specific analogues (throughput, failure rate, processing time).
- USE requires resource-specific instrumentation; generic host metrics alone (CPU%) miss application-level saturation like connection pool exhaustion.
- Combining both is necessary — RED alone can show "latency is high" without USE explaining "because the DB pool is saturated."

**Common mistakes.**
- Applying only RED and never checking underlying resource saturation, so the "why" behind a RED symptom stays a mystery.
- Building a different, bespoke dashboard layout per service, making on-call context-switching slower during an incident.
- Not adapting RED for async workloads (queues, workers) and just leaving them unmonitored.

**Interview answer.** "RED gives a consistent way to monitor request-driven services — rate, errors, duration — and USE does the same for resources — utilization, saturation, errors. Using both means a dashboard reliably shows both the symptom (RED) and the likely cause (USE)."

**Practice problem.** Build one RED dashboard for an API and one USE dashboard for its MySQL connection pool and host resources, then simulate load and identify which USE metric explains a RED-visible latency spike.

**Production considerations.** Standardize dashboard templates across services using RED/USE so on-call rotations don't need to relearn a new layout for every service.

---

## 19.6 Dashboards

**Definition.** A dashboard is a curated visual arrangement of metrics/logs meant to answer specific operational questions at a glance.

**Why it's needed.** Raw metrics are only useful if someone can look at them quickly and correctly during a stressful incident — a good dashboard turns "check twelve different graphs" into "look at this one screen."

**How it works internally.** A dashboarding tool (Grafana, CloudWatch Dashboards, Datadog) queries the metrics/log backend and renders panels; dashboards are usually defined as JSON/config so they can be version-controlled alongside the service.

**Syntax / API.**
```json
{
  "title": "Sessions API - Overview",
  "panels": [
    { "title": "Request Rate", "query": "rate(http_requests_total{service=\"sessions\"}[5m])" },
    { "title": "Error Rate", "query": "rate(http_requests_total{service=\"sessions\", status_code=~\"5..\"}[5m]) / rate(http_requests_total{service=\"sessions\"}[5m])" },
    { "title": "p95 Latency", "query": "histogram_quantile(0.95, http_request_duration_seconds_bucket{service=\"sessions\"})" },
    { "title": "DB Pool Saturation", "query": "db_pool_connections_in_use{service=\"sessions\"} / db_pool_max" }
  ]
}
```

**Real backend usage.** One "overview" dashboard per service (RED signals) linked from the alert notification itself, so clicking an alert lands directly on the relevant graphs instead of a generic landing page.

**Edge cases.**
- Too many panels on one dashboard defeats the purpose — during an incident, people need the 4–6 signals that matter, not forty.
- Dashboards built ad hoc in the UI and never version-controlled drift out of sync with what the team actually needs, and get lost when someone leaves.
- A dashboard showing only current values (no historical comparison) makes it hard to tell "is this normal for a Monday morning" from "this is an anomaly."

**Common mistakes.**
- Building dashboards reactively, one per incident, instead of proactively per-service using RED/USE as the template.
- No baseline/comparison view (e.g., "same time last week"), forcing engineers to guess whether a value is actually abnormal.
- Dashboards owned by no one, so they silently break when a metric name changes and nobody notices.

**Interview answer.** "A dashboard's job is to answer 'is this service healthy' in one glance during an incident. I template them around RED/USE, version-control the definition, and link them directly from alerts so responders land on the right graphs immediately, not a generic homepage."

**Practice problem.** Build a service-overview dashboard with request rate, error rate, p95/p99 latency, and DB pool saturation, and link it from that service's high-error-rate alert.

**Production considerations.** Store dashboard definitions as code in the repo, reviewed like any other change, so they evolve alongside the service instead of drifting.

---

## 19.7 Alerts

**Definition.** An alert is an automated notification triggered when a metric crosses a defined threshold, meant to bring a human's attention to a real, actionable problem.

**Why it's needed.** Nobody watches dashboards 24/7 — alerts are how the system tells a human "look now" instead of relying on someone noticing a graph or a customer complaint.

**How it works internally.** An alerting rule continuously evaluates a metric query against a threshold over a time window; when it's breached for the configured duration, it fires a notification (PagerDuty, Slack, email) and stays "firing" until the condition clears.

**Syntax / API.**
```yaml
alert: HighErrorRate
expr: rate(http_requests_total{status_code=~"5..", service="sessions"}[5m])
    / rate(http_requests_total{service="sessions"}[5m]) > 0.05
for: 5m
labels:
  severity: page
annotations:
  summary: Sessions API error rate above 5% for 5 minutes
  dashboard: https://grafana.internal/d/sessions-overview
  runbook: https://runbooks.internal/sessions-high-error-rate
```

**Real backend usage.** Paging alerts for symptoms a customer would notice right now (high error rate, high latency, service down); non-paging (Slack) alerts for things that need attention soon but aren't urgent (disk filling up over days, a background job queue growing steadily).

**Edge cases.**
- Alerting on a metric without a `for` duration fires on brief, harmless blips.
- Static thresholds don't fit services with strong daily/weekly traffic patterns — a fixed "1000 req/min" threshold is meaningless if normal traffic swings between 200 and 5000.
- Too many low-value alerts cause alert fatigue, and real pages start getting ignored or acknowledged without real investigation.

**Common mistakes.**
- Paging for anything that isn't actually actionable right now (alert fatigue).
- No link from the alert to a dashboard or runbook, forcing the responder to start from zero every time.
- Alerting only on infrastructure symptoms (CPU high) and never on the user-facing symptoms that actually matter (error rate, latency).

**Interview answer.** "A good alert is actionable, has a clear severity, and links directly to a dashboard and a runbook. I alert on symptoms customers would feel — error rate, latency, saturation — rather than every possible internal metric, to keep the signal-to-noise ratio high enough that pages are trusted."

**Practice problem.** Define an alert for p95 latency exceeding 1 second for 5 minutes, with a link to the relevant dashboard and a written runbook, and one non-paging warning alert for DB pool saturation crossing 80%.

**Production considerations.** Regularly review alerts that fired but weren't actionable and either fix the underlying issue or tune/remove the alert — an alert nobody acts on is worse than no alert.

---

## 19.8 SLO, SLA, and SLI

**Definition.** An SLI (Service Level Indicator) is a measured metric (e.g., percentage of requests under 300ms); an SLO (Service Level Objective) is an internal target for that indicator (e.g., 99.9% of requests under 300ms over 30 days); an SLA (Service Level Agreement) is an external, often contractual commitment with consequences for missing it.

**Why it's needed.** Without an explicit objective, "is the service reliable enough" is a matter of opinion. SLOs turn reliability into a measurable, agreed-upon target that both engineering and the business can reason about.

**How it works internally.** The SLI is computed continuously from metrics (e.g., `good_requests / total_requests`). The gap between 100% and the SLO target is the "error budget" — the amount of unreliability allowed before the objective is breached, which teams can deliberately spend on risk (deploys, experiments) or preserve.

**Syntax / API.**
```text
SLI: percentage of requests completing in < 300ms
SLO: 99% of requests over trailing 30 days meet the SLI
Error budget: 1% of requests over 30 days may be slow (~432 minutes of a fully-slow month equivalent)

query:
  sli = sum(rate(http_request_duration_seconds_bucket{le="0.3"}[30d]))
      / sum(rate(http_request_duration_seconds_count[30d]))
```

**Real backend usage.** A learner-facing session API might have an SLO of "99.9% availability, p95 < 400ms over 30 days"; if the error budget is nearly exhausted mid-month, the team deliberately slows down risky deploys until it recovers.

**Edge cases.**
- Setting an SLO too strict (99.99%) forces expensive engineering effort for marginal user-perceived benefit; too loose (95%) may not reflect what users actually tolerate.
- SLIs must be measured from the user's perspective (edge/gateway) where possible, not just server-side, since network issues between user and edge aren't visible server-side.
- An SLA is a business/legal commitment and should always be set looser than the internal SLO, leaving margin for error.

**Common mistakes.**
- Confusing SLA (external, contractual) with SLO (internal target) and using them interchangeably.
- Defining an SLO without an error budget policy, so nobody knows what to actually do when it's breached.
- Picking an SLI that's easy to measure but doesn't reflect real user experience (e.g., server uptime instead of successful, fast responses).

**Interview answer.** "SLI is the measured indicator, SLO is the internal target for it, and SLA is the external commitment with consequences. The gap between the SLO and perfect reliability is the error budget — a practical tool for deciding how much risk (deploys, experiments) the team can afford to take this month."

**Practice problem.** Define an SLI, SLO, and error budget for a session-booking endpoint, and write the query that computes the SLI from existing latency/error metrics.

**Production considerations.** Tie deploy/release policy to the error budget explicitly (e.g., freeze risky changes when the budget is nearly exhausted) so the SLO is a real operating constraint, not just a number in a doc.

---

## 19.9 Incident Response

**Definition.** The structured process a team follows from "something is wrong" to "the issue is resolved and understood" — detection, triage, mitigation, resolution.

**Why it's needed.** Without a process, incidents are handled inconsistently — response time varies by who happens to be around, communication is ad hoc, and mitigation is improvised under pressure.

**How it works internally.** An alert (or a report) triggers detection; an on-call engineer is paged and acknowledges; severity is assessed and communicated; mitigation (rollback, feature flag off, scale up) is applied to stop user impact first, with root-cause investigation following once impact is contained; resolution is declared once the mitigating/fixing action is confirmed effective.

**Syntax / API.**
```text
1. Detect   -> alert fires / user report
2. Acknowledge -> on-call confirms they're investigating (stops re-paging)
3. Assess severity -> Sev1 (major outage) .. Sev4 (minor, no user impact)
4. Communicate -> status page / internal channel updated
5. Mitigate -> rollback, disable feature flag, scale resource, failover
6. Resolve -> confirm impact has stopped
7. Postmortem -> scheduled afterward (see 19.11)
```

**Real backend usage.** A deploy causes a spike in 500s on the session-booking endpoint; the on-call engineer acknowledges the page, declares a Sev2, rolls back the deploy (mitigation) within minutes, confirms the error rate metric drops, then schedules a postmortem — full root-cause investigation happens after impact stops, not before.

**Edge cases.**
- Mitigation and root-causing are different goals — chasing the root cause before mitigating prolongs user impact unnecessarily.
- Multiple simultaneous incidents need clear ownership, or duplicate/conflicting mitigation attempts can make things worse.
- Not every anomaly is an incident — a defined severity scale prevents both under-reacting to real outages and over-reacting to noise.

**Common mistakes.**
- Debugging the root cause live in production before doing any mitigation, extending the outage.
- No clear single incident commander/owner during a major incident, causing conflicting actions.
- Treating every paged alert as equally severe instead of triaging quickly.

**Interview answer.** "Incident response separates 'stop the bleeding' from 'understand why it happened.' Mitigation — rollback, flag off, scale up — comes first to limit user impact; the full root-cause investigation happens afterward in a postmortem, so responders aren't debugging live while users are affected."

**Practice problem.** Write an incident runbook entry for "error rate alert fires after a deploy," specifying the exact mitigation steps (how to roll back, how to verify) before any root-cause investigation begins.

**Production considerations.** Practice incident response before a real incident (game days / chaos drills) so the process is familiar under pressure, not being invented live.

---

## 19.10 Runbooks

**Definition.** A runbook is a written, step-by-step procedure for responding to a specific, known failure mode.

**Why it's needed.** During an incident, working memory and judgment are both degraded by stress and time pressure; a runbook turns "figure out what to do" into "follow these steps," reducing time-to-mitigation and inconsistency between responders.

**How it works internally.** Linked directly from the alert that corresponds to the failure mode it addresses (see 19.7), so the responder goes from page → runbook with zero searching, and follows concrete commands/checks rather than general advice.

**Syntax / API.**
```markdown
# Runbook: Sessions API High Error Rate

## Trigger
Alert "HighErrorRate" fires for service=sessions.

## Immediate checks
1. Open the Sessions Overview dashboard: <link>
2. Check recent deploys: `kubectl rollout history deployment/sessions-api`
3. Check DB pool saturation panel — if saturated, see "DB Pool Exhaustion" runbook instead.

## Mitigation
1. If a deploy in the last 30 minutes correlates with the spike:
   `kubectl rollout undo deployment/sessions-api`
2. Confirm error rate returns below 1% within 5 minutes on the dashboard.
3. If not deploy-related, scale up: `kubectl scale deployment/sessions-api --replicas=6`

## Escalation
If error rate doesn't recover in 15 minutes, page the sessions-api owning team lead.
```

**Real backend usage.** A runbook per known alert (high error rate, DB pool exhaustion, queue backlog growing, disk space low), stored in the repo/wiki, kept up to date as part of the definition-of-done when a new alert is added.

**Edge cases.**
- A runbook that isn't updated after an architecture change gives confidently wrong instructions, which is worse than no runbook.
- Runbooks work for known failure modes — genuinely novel incidents still need judgment, but even then a "where are the dashboards, who to escalate to" runbook skeleton helps.
- Overly generic runbooks ("check the logs") provide little more value than no runbook at all.

**Common mistakes.**
- Writing a runbook once and never testing or updating it as the system changes.
- Runbooks that describe *what* is wrong but not concrete *commands* to run.
- No runbook at all for the most common/likely alerts, forcing the same investigation to be redone from scratch every time.

**Interview answer.** "A runbook converts institutional knowledge about a specific failure mode into concrete, testable steps, linked directly from the alert. It shortens time-to-mitigation and makes response consistent across whoever happens to be on call, instead of depending on one person's memory."

**Practice problem.** Write a runbook for "DB connection pool exhausted" including detection signal, immediate checks, and concrete mitigation commands.

**Production considerations.** Review and test runbooks periodically (not just after an incident reveals they were wrong) and require one for every new paging alert before it ships.

---

## 19.11 Postmortems

**Definition.** A written, blameless account of an incident: timeline, impact, root cause, what went well/poorly in the response, and concrete follow-up action items.

**Why it's needed.** Without a structured retrospective, the same class of incident recurs because the underlying systemic cause (not just the immediate trigger) was never fixed.

**How it works internally.** Written after mitigation, using timestamps pulled from logs/metrics/alerts/chat history rather than memory; focuses on systemic contributing factors ("no alert existed for this condition," "rollback took 20 minutes because of a manual step") rather than individual blame; produces tracked action items with owners and deadlines.

**Syntax / API.**
```markdown
# Postmortem: Sessions API Outage — 2026-09-12

## Summary
Sessions API returned elevated 500s for 22 minutes after a deploy introduced
an unhandled null case for sessions with no assigned trainer.

## Impact
~4% of session-detail requests failed; no data loss.

## Timeline (UTC)
14:02 - Deploy shipped
14:05 - HighErrorRate alert fired, on-call paged
14:07 - On-call acknowledged
14:11 - Rollback initiated
14:16 - Rollback completed, error rate back to baseline
14:24 - Incident declared resolved

## Root cause
New response serializer assumed `trainer` was always present; unassigned
sessions caused a TypeError.

## What went well
- Alert fired within 3 minutes of impact starting.
- Rollback fully mitigated impact in under 15 minutes.

## What went poorly
- No test coverage for sessions without an assigned trainer.
- Rollback required a manual kubectl command; no one-click rollback existed.

## Action items
- [ ] Add null-trainer test case to serializer test suite (owner: A, due: Fri)
- [ ] Add one-click rollback to deploy pipeline (owner: B, due: next sprint)
```

**Real backend usage.** Every Sev1/Sev2 incident gets a postmortem within a few days while details are fresh; action items are tracked in the normal issue tracker, not left in a document nobody revisits.

**Edge cases.**
- Postmortems that assign blame to a person instead of a system discourage honest timelines and reporting in the future.
- Action items without an owner or deadline rarely get done.
- Writing the postmortem too long after the incident loses timeline accuracy — memory fades and chat logs scroll away.

**Common mistakes.**
- Treating the postmortem as a formality rather than tracking action items to completion.
- Framing the root cause as "engineer X made a mistake" instead of "what let that mistake reach production without being caught."
- Skipping postmortems for incidents that were "quickly fixed," missing recurring near-misses.

**Interview answer.** "A good postmortem is blameless and systemic — it asks what let the failure reach production and what would prevent the *class* of failure, not just this instance, and it produces tracked, owned action items rather than being a one-time writeup nobody revisits."

**Practice problem.** Write a postmortem for a hypothetical incident where a background job double-charged a payment due to a non-idempotent retry, including at least two systemic (not individual-blame) action items.

**Production considerations.** Track postmortem action-item completion rate as its own metric — a team that writes postmortems but never completes the follow-ups is set up to repeat the same incident.

---

## 19.12 Audit Trails

**Definition.** An audit trail is an append-only, tamper-evident record of who did what, to what, and when — distinct from application/debug logs.

**Why it's needed.** Debug logs are for engineers investigating bugs; audit trails are for answering compliance, security, and dispute questions ("who changed this learner's grade, and when") long after the fact, sometimes required by regulation.

**How it works internally.** Every sensitive action (create, update, delete, permission change, login) writes a dedicated audit record — actor, action, target entity, before/after values where relevant, timestamp, source IP — typically to an append-only store separate from normal application logs, since audit records must not be editable or easily deletable.

**Syntax / API.**
```javascript
const recordAudit = async ({ actorId, action, entityType, entityId, before, after, ip }) => {
  await db.query(
    'INSERT INTO audit_log (actor_id, action, entity_type, entity_id, before_state, after_state, ip_address, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, NOW())',
    [actorId, action, entityType, entityId, JSON.stringify(before), JSON.stringify(after), ip]
  )
}

const updateLearnerGrade = async (req, res) => {
  const before = await gradeRepository.findById(req.params.id)
  const after = await gradeRepository.update(req.params.id, req.body)
  await recordAudit({
    actorId: req.user.id,
    action: 'GRADE_UPDATED',
    entityType: 'grade',
    entityId: req.params.id,
    before,
    after,
    ip: req.ip
  })
  res.json(after)
}
```

**Real backend usage.** Every grade change, permission change, and record deletion in an LMS recorded to an audit table, queryable by an admin ("show every change to this learner's record this term") separate from and retained longer than general application logs.

**Edge cases.**
- Audit records containing before/after state can themselves hold sensitive data and need the same access controls as the underlying data.
- If audit writes aren't part of the same transaction as the action itself, a crash between the two can leave the action unrecorded.
- Retention requirements for audit trails (often years, for compliance) differ from and usually exceed general log retention.

**Common mistakes.**
- Reusing general application logs as the "audit trail," where they're mixed with debug noise and don't have the durability/immutability guarantees needed.
- Not recording *who* performed an action, only *that* it happened.
- Allowing audit records to be updated or deleted through normal application code paths, undermining their purpose.

**Interview answer.** "An audit trail is a compliance/security record, separate from debug logs — append-only, actor-attributed, and retained on its own policy. I write it in the same transaction as the action it records, so the two can't drift apart if something fails partway through."

**Practice problem.** Add an audit trail for permission/role changes on user accounts, recording actor, target user, old role, new role, and timestamp, in the same transaction as the role update itself.

**Production considerations.** Restrict write access to the audit store to the application's own service account only, and make deletion require a separate, tightly controlled process (or be disallowed entirely) so the trail stays trustworthy as evidence.

---

## Practice Exercises for Phase 19

Apply this phase to an existing service (ideally one you already run, like an LMS backend):

1. **Structured logging** — replace `console.log` calls with a structured logger that includes `requestId` on every line.
2. **RED dashboard** — instrument request rate, error rate, and latency histograms for at least two routes, and build a dashboard from them.
3. **USE dashboard** — expose DB pool saturation and event loop lag as gauges, and build a resource dashboard.
4. **Alert + runbook pair** — define one alert (e.g., high error rate) with a `for` duration and a linked runbook containing concrete mitigation commands.
5. **SLO definition** — pick one endpoint, define an SLI/SLO/error budget, and write the query that computes the SLI from your existing metrics.
6. **Incident simulation** — deliberately break a non-production instance (e.g., exhaust the DB pool), practice detecting it via your dashboard/alert, and mitigate using your runbook.
7. **Postmortem** — write a real (or simulated) postmortem for the incident above, with at least two systemic action items.
8. **Audit trail** — add an audit record for one sensitive write operation, recorded in the same transaction as the operation itself.

---

## Phase 19 Completion Checklist

- [ ] Emits structured (JSON) logs with a propagated request/correlation ID.
- [ ] Exposes request rate, error rate, and latency histograms per route (RED).
- [ ] Exposes at least one resource saturation metric — DB pool, event loop lag, or similar (USE).
- [ ] Can explain why percentiles (p95/p99) matter over averages for latency.
- [ ] Has at least one dashboard built from RED/USE signals, linked from an alert.
- [ ] Has at least one alert with a `for` duration and a linked runbook.
- [ ] Can define SLI, SLO, SLA, and error budget precisely and distinguish them from each other.
- [ ] Can describe an incident response flow that mitigates before root-causing.
- [ ] Has written (or practiced writing) a blameless postmortem with tracked action items.
- [ ] Distinguishes audit trails from debug logs and knows when each is required.
