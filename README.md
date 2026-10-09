<p align="center"><img src="brand/umbra-mark.svg" width="120" alt="Umbra logo, an eclipse ringed by particles"></p>

<h1 align="center">Umbra</h1>
<p align="center">Using AI to govern AI inside a company.</p>
<p align="center"><a href="https://murtuzabuilds.github.io/umbra/"><b>Live console</b></a> · <a href="https://murtuzabuilds.github.io/umbra/case-study.html"><b>Case study</b></a></p>

![Umbra overview screen](docs/totality.webp)

Umbra is a concept product I designed and built. It shows a company every AI tool and agent its people are using, catches sensitive data before it is sent to them, and turns the unapproved tools it finds into a ranked list of where to invest in approved AI next.

## Why I built it

A lot of people now use AI at work that their employer never approved. In a January 2026 survey of 2,000 workers, 49% said they had, and 63% said it was fine when no approved option existed ([BlackFog, via CIO](https://www.cio.com/article/4124760/roughly-half-of-employees-are-using-unsanctioned-ai-tools-and-enterprise-leaders-are-major-culprits.html)). Blocking tools doesn't really fix that. People just use them somewhere IT can't see.

The early AI security startups were bought by large security vendors in 2024 and 2025, and their tools mostly focus on blocking. I wanted to try a different approach, closer to my background in digital transformation: protect the data, but also learn from what people are trying to do.

## Three ideas behind it

1. **Unapproved AI use shows what people need.** If a team keeps using an unapproved tool for a task, that is a sign they need an approved one. The Demand Map groups this by team and task and ranks where a tool would help most.
2. **AI can help write the rules, but not enforce them.** Umbra's AI layer, Corona, drafts rules from plain English, spots unregistered AI services and summarises incidents. The actual block or allow decision comes from fixed rules that give the same answer every time, and a person approves any new rule.
3. **Agents need owners and limits.** Each agent gets a named owner and a list of what it may do. Every call is checked against that list, and Umbra estimates how much data could be reached through an agent if it were compromised.

## What's in the console

| | |
|---|---|
| **Totality**: how much AI use is visible, the share on approved tools, how much sensitive data was stopped, and open cases | **Constellation**: every AI service on one map, placed by risk and usage |
| ![](docs/totality.webp) | ![](docs/constellation.webp) |
| **Inspect**: check any text, see what gets masked and which rules applied | **Agents**: who calls what, calls outside the limits, owners and exposure |
| ![](docs/inspect.webp) | ![](docs/agents.webp) |
| **Policies**: write a rule in a sentence and replay the last 30 days before turning it on | **Incidents**: 888 raw alerts grouped into 62 cases, each with a short summary |
| ![](docs/time-machine.webp) | ![](docs/incidents.webp) |
| **Demand Map**: where approved AI would help most, as a now, next and later list | **Assurance**: controls mapped to the EU AI Act, ISO/IEC 42001, NIST AI RMF and SOC 2, with exports |
| ![](docs/demand.webp) | ![](docs/assurance.webp) |

![What an employee sees](docs/coach.webp)

### The central intelligence

The Totality card shows Umbra as a black hole with every AI service found at Kestrel Mutual on orbit: approved services on the inner rings, unapproved and high-risk ones further out, size by how much each was used. Three things live on it, all driven by the same sample data and rules as the rest of the console:

- **Time machine.** A scrubber replays the 30 days of sample events. A service appears on the day it was first seen, grows with its interactions, and a pulse from the core marks each sensitive interaction a rule blocked, masked or held that day. The counters are computed for that day and the replay ends on today.
- **Red-team drill.** Three hostile sample interactions (an unregistered agent posting customer records to an outside host, a hidden instruction inside a customer email, a confidential file pasted into an unapproved tool) go through the real rule engine. A beam pulls a planet back only when a rule actually stopped it. With the default rules, one of three is stopped, and the other two are shown as gaps with the switched-off rule that would catch each (P-08 and the new P-09).
- **How this view works.** A "?" overlay explains the rings, colours, scrubber and drill in plain words. Stars bend slightly around the core and the cursor, and an optional synthesised sound (off by default) hums near the core and chimes when something is contained or approved.

### Approve an agent and send it to Outpost

From the Agents view (or the weekly brief), the unowned agent can be approved: pick an owner from Kestrel's people, tick the permissions it may use (defaults come from what it was seen doing; risky ones such as sending data outside the company stay unticked and say why), and set how much money it may move alone. On confirm, Umbra registers it with that owner and mandate, the maturity level updates, its planet turns green, and Umbra hands it to Outpost: it writes `umbra.outpost.handoff` to local storage and opens Outpost with the same record in a `#dock=` link. The shape is fixed and tested in `src/handoff.js`.

## Where Umbra stops

Umbra is a governance product. It decides which AI gets into the company and what data may reach it. It does not run the work. Once an agent is approved, with a named owner and a list of what it may touch, someone still has to run it day to day, sign off its risky calls and answer for its output. That is a different job for a different person, and I built it as a separate product, [Outpost](https://github.com/murtuzabuilds/outpost).

| | Umbra | Outpost |
|---|---|---|
| The job | Governance | Operations |
| Who uses it | The security or risk lead | The operations lead who runs a crew of agents |
| Looks at | Every AI tool across the company, and the content flowing into it | One crew, one action at a time. It never reads the content |
| Timescale | Weeks and quarters | Seconds and minutes |

They meet at one handoff: an approved agent with a named owner and a list of what it may touch. Both demos use the same fictional insurer, Kestrel Mutual.

## The code

Plain JavaScript with no dependencies. The engine lives in `src/` and everything in it is tested.

| File | What it does |
|---|---|
| `catalog.js` | The list of AI services, and a risk score based only on facts you can check about each vendor |
| `detect.js` | Finds sensitive data and confirms matches (Luhn for cards, IBAN checksums, SSN rules), then masks it |
| `policy.js` | Rules as data. The strictest matching rule wins, and every decision records which rules applied |
| `agents.js` | Agent owners and limits, call checks, chain depth, and exposure through other agents |
| `corona.js` | The AI layer: rule drafting, unregistered AI detection, checks for hidden instructions in agent messages, incident summaries |
| `timeline.js` | The month replayed day by day for the time machine |
| `drill.js` | Red-team drill cases, run through the real engine, and the switched-off rule that would catch a gap |
| `handoff.js` | The Umbra to Outpost handoff: tool whitelist, size caps, base64url link |
| `triage.js` | Groups alerts into cases and closes the ones rules already handled |
| `simulate.js` | Replays past activity against a draft set of rules |
| `demand.js` | The Demand Map |
| `compliance.js` | Eight controls measured from live data, framework mappings and the evidence pack |
| `index.js` | Runs everything, plus the maturity scale and the AI inventory export |

```bash
npm test      # 31 tests
npx serve .   # open the console
```

In this prototype, Corona's skills are simple local stand-ins so the demo runs offline and costs nothing. In a real product each one would call an AI model, limited to producing output in the same format, and it would still never make the final decision.

## Business model (proposed)

The target is regulated companies with 500 to 5,000 employees, such as insurers, fintechs, healthcare and legal firms. They would start with a free, read-only 48-hour scan that produces the AI map and the Demand Map. Paid plans would be Govern at $6 per employee per month, Assure at $3 more, and $25 per agent per month. The [case study](https://murtuzabuilds.github.io/umbra/case-study.html) has the full reasoning.

## Brand

The logo is an eclipse: a dark disc for the AI a company can't see, ringed by particles for what Umbra shows, built from the same square particles as my personal logo. In motion the corona turns, twinkles and leans toward your cursor, and a small flare circles the rim.

Colors are Void `#05060A`, Corona `#F5E6C8`, Flare `#FFB347`, Plasma `#8B7CFF` and Aurora `#3BE8B0`. Fonts are Space Grotesk for the interface, Instrument Serif for voice and JetBrains Mono for data. The static mark is `brand/mark.js` and the animated one is `brand/eclipse.js`.

---

Built by [Murtuza](https://github.com/murtuzabuilds). Kestrel Mutual and all vendors in the demo are made up, and the data is generated. The framework mappings are for illustration. MIT licensed.
