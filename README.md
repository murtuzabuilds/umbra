<p align="center"><img src="brand/umbra-mark.svg" width="120" alt="Umbra mark: an eclipse ringed by a corona of particles"></p>

<h1 align="center">Umbra</h1>
<p align="center"><b>AI that governs AI.</b><br>Find every AI tool and agent in the company. Stop data leaks before they happen. Turn shadow AI into the AI roadmap.</p>
<p align="center"><a href="https://murtuzabuilds.github.io/umbra/"><b>Live console</b></a> · <a href="https://murtuzabuilds.github.io/umbra/case-study.html"><b>Case study</b></a> · 16 tests · no dependencies</p>

![Umbra Totality overview](docs/totality.webp)

## Why this exists

We have spent three years asking what AI can make. The harder question now is who governs the AI that is already everywhere.

- **49%** of workers admit to using AI tools their employer never approved, and **63%** think that is fine when no approved option exists ([BlackFog survey via CIO, Jan 2026](https://www.cio.com/article/4124760/roughly-half-of-employees-are-using-unsanctioned-ai-tools-and-enterprise-leaders-are-major-culprits.html)).
- The first wave of AI security startups was bought by platform vendors in 2024 and 2025. Those tools are built for the largest enterprises, and built to say no.
- The EU AI Act's transparency duties apply from August 2026. High-risk duties were deferred to December 2027, not cancelled.

Security has been the department of no. In the AI era, no is how you lose.

## Three ideas that make Umbra different

1. **Shadow AI is demand, not deviance.** Every unapproved tool marks a job nobody equipped people for. Umbra's **Demand Map** turns shadow usage into a ranked AI transformation backlog for the CIO.
2. **AI governs AI, but never enforces alone.** **Corona**, the AI layer, drafts policy from plain English, discovers unregistered AI endpoints, defends agents from injection and explains incidents. Enforcement stays deterministic: *AI proposes, rules dispose, people approve.*
3. **Agents are the new insiders.** Every agent gets an identity, an owner and a **mandate**. Umbra checks every hop at the MCP gateway and computes each agent's **blast radius** through delegation.

## The console

| | |
|---|---|
| **Totality**: how much AI is in view, the paved-road rate, leak prevention, SOC load, and Corona's morning brief | **Constellation**: every AI destination mapped by risk and use, with discovery from five signals |
| ![](docs/totality.webp) | ![](docs/constellation.webp) |
| **Inspect**: validated detectors, redaction, and a rule trace for every decision. Paste your own text | **Agents**: the delegation graph, mandate violations, blast radius, quarantine and registration |
| ![](docs/inspect.webp) | ![](docs/agents.webp) |
| **Policies + time machine**: write a rule in a sentence, replay 30 days before enforcing | **Incidents**: 888 alerts become 62 decisions, each narrated for analyst and employee |
| ![](docs/time-machine.webp) | ![](docs/incidents.webp) |
| **Demand Map**: shadow AI as a Now / Next / Later roadmap | **Assurance**: controls mapped to the EU AI Act, ISO/IEC 42001, NIST AI RMF and SOC 2, with evidence pack and AI bill of materials |
| ![](docs/demand.webp) | ![](docs/assurance.webp) |

![Employee coaching](docs/coach.webp)

## The engine

Plain JavaScript modules in `src/`, pure and deterministic, so every rule is readable and tested.

| Module | What it does |
|---|---|
| `catalog.js` | AI service catalog and a risk score built only from verifiable vendor facts |
| `detect.js` | Detectors with validators (Luhn, IBAN mod-97, SSN issuance rules), org dictionaries, stable redaction |
| `policy.js` | Policy as data; the strictest matching rule wins; a full trace for every decision; the paved-road alternative |
| `agents.js` | Agent identities and mandates, call checks, delegation depth, blast radius |
| `corona.js` | The AI layer: plain-English policy compiler with round-trip, endpoint classifier, injection signals, incident narrator |
| `triage.js` | Groups alerts by the decision a human makes; auto-closes what policy contained; residual-risk scoring |
| `simulate.js` | The policy time machine |
| `demand.js` | The Demand Map: team × job-to-be-done, shadow share, growth, projected hours |
| `compliance.js` | Eight controls computed from live state, framework mappings, evidence pack |
| `index.js` | `run()` ties it together; maturity model; `aibom()` exports a CycloneDX-style AI bill of materials |

```bash
npm test        # 16 tests, zero dependencies
npx serve .     # open the console
```

```js
import { run, compilePolicy } from './src/index.js';
const r = run();                       // 30 days of synthetic telemetry, fully governed
r.metrics.preventionRate;              // share of sensitive events contained
compilePolicy('Block health data from going to unapproved tools').readable;
// → "Block when the content contains health data and the tool is not approved."
```

Corona runs here as local, deterministic stand-ins so the demo works offline and free. In production each skill is a model call constrained to the same output schema, and it never sits on the enforcement path.

## Product principles

1. **Light before law.** Discovery ships first, from logs the company already has.
2. **Deterministic at the edge.** Same input, same decision, with a trace an auditor can read.
3. **Coach before block.** Redact-and-send and a better road beat a wall.
4. **Every agent has an owner.** Autonomy is granted, never assumed.
5. **Evidence is a byproduct.** Compliance is a download, not a project.
6. **Measure the paved road.** The north star is the share of AI work on approved tools.

## Go to market, in one breath

Regulated mid-market companies (500 to 5,000 people). Land with a free, read-only 48-hour **Shadow AI Scan** that produces a Constellation and a Demand Map; expand into **Govern** ($6 per employee per month), **Assure** (+$3) and **Agents** ($25 per agent per month). Proposed pricing; the full reasoning is in the [case study](https://murtuzabuilds.github.io/umbra/case-study.html).

## Brand

An eclipse: a dark disc, the AI you cannot see into, ringed by a corona of particles, the light Umbra brings. Void `#05060A`, Corona `#F5E6C8`, Flare `#FFB347`, Plasma `#8B7CFF`, Aurora `#3BE8B0`. Space Grotesk, Instrument Serif, JetBrains Mono. Tokens in `brand/tokens.css`; the mark is generated deterministically by `brand/mark.js`.

---

Umbra is a concept product, researched, designed and built by [Murtuza](https://github.com/murtuzabuilds). Kestrel Mutual and every vendor in the demo are fictional; all data is synthetic. Framework mappings are illustrative. MIT licensed.
