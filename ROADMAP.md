# SavePlate Project Roadmap

Predictive food-surplus management for campus cafeterias.

Status: execution roadmap
Planning date: 23 November 2026 WIB

## Mission

Submit a reliable, deployable software MVP that demonstrates one closed loop:

```text
seller input → surplus prediction → discount recommendation → student claim → outcome log → impact dashboard
```

The product wins by proving one decision changes one measurable outcome. Do not build a broad marketplace.

## Competition constraints

The local rulebook specifies:

- Software Development submission window: 1–30 November
- Public, working website link
- Public, active GitHub repository
- Proposal: maximum 25 pages, excluding cover, references, and appendices
- Demonstration video: maximum 5 minutes
- Judging emphasis: theme fit 25%, functionality/code/deployment 30%, innovation/originality 20%, problem urgency 15%, UI/UX/accessibility 10%
- Earlier submission is the tie-breaker when scores are equal

Source: `SEVENT X - Software Development Rulebook.pdf`, pp. 10–16.

The rulebook does not state an exact submission closing time. Confirm the final time, template, and any changes through the official Discord and Instagram before submission. Internal target: freeze the project by 29 November, 18:00 WIB; submit before the official deadline.

## Score strategy

| Rubric | Evidence to build |
|---|---|
| Theme fit — 25% | SDG 12 problem statement, food-waste workflow, measured impact metrics |
| Functionality/code/deployment — 30% | Complete golden path, public URL, public repository, validation, error states |
| Innovation/originality — 20% | Prediction connected to a seller intervention and verified outcome, not a passive listing |
| Problem urgency — 15% | United Nations evidence plus local interviews/measurements; no invented campus statistics |
| UI/UX/accessibility — 10% | Mobile-responsive layout, keyboard access, labels, contrast, clear user journey |

## Scope freeze

### Build

- Seller dashboard
- Manual sales/stock input
- Surplus prediction
- Transparent baseline comparison
- Discount recommendation
- Public discounted listing
- Student claim and pickup reference
- Closing outcome logging
- Impact dashboard
- Deterministic demo data
- Public deployment
- Public GitHub repository

### Do not build

- Payment gateway
- Delivery
- Multi-campus support
- Computer vision
- IoT weighing hardware
- Chatbot
- Automated disposal
- Complex dynamic pricing
- Donation logistics without a real partner
- Full account/authentication system unless the chosen stack already makes it trivial

## Seven-day execution plan

Current date: 23 November 2026. The plan assumes seven calendar days until 30 November. All outputs remain provisional until actually tested.

### Phase 0 — Freeze the product

Date: 23 November

Tasks:

- Confirm the target user: one campus cafeteria seller.
- Confirm the secondary user: one student buyer.
- Write the one-sentence product definition.
- Freeze the golden-path screens.
- Create the issue list with P0/P1/P2 labels.
- Decide the existing technology stack in 30 minutes or less.
- Create one deterministic demo scenario.

Deliverables:

- One-sentence product definition
- Screen flow
- Minimal data schema
- P0 issue list
- Demo fixture

Gate:

> No feature enters the build unless it improves rubric score, demo reliability, evidence, or the primary user outcome.

### Phase 1 — Validate the problem and data

Date: 24 November

Tasks:

- Interview at least five cafeteria sellers or food-service operators.
- Ask how they estimate demand, handle leftovers, and record waste.
- Record interview date, participant type, questions, and exact observations.
- Define the dataset fields.
- Separate real, simulated, and synthetic data.
- Build the weekday-average baseline.

Deliverables:

- Interview notes
- `data/README.md` with provenance and limitations
- Demo dataset
- Baseline prediction output

Gate:

> A reviewer can identify every data row’s source and reproduce the baseline output.

Fallback:

If seller access fails, use proxy usability testers and clearly label the evidence as proxy feedback. Do not claim seller validation.

### Phase 2 — Prove the prediction claim

Date: 25 November

Tasks:

- Implement the baseline first:

  ```text
  expected demand = average demand for the same category and weekday
  ```

- Add a candidate model only if the dataset supports it.
- Use a time-aware or held-out test split.
- Prevent future sales information from entering prediction features.
- Compare baseline and candidate model with MAE.
- Save the evaluation output.
- Define the low-confidence fallback: manual review.

Deliverables:

- Reproducible evaluation command
- Baseline metric
- Candidate-model metric, if justified
- Short limitations note

Gate:

> The candidate model either beats the baseline on held-out data or is removed. No “AI” label without measured contribution.

Fallback:

If the model does not beat the baseline, ship the transparent baseline as the forecasting engine and describe the candidate model as rejected during validation.

### Phase 3 — Build the seller workflow

Date: 26 November

Tasks:

- Build seller input form.
- Validate required fields and numeric ranges.
- Show current stock, expected demand, surplus estimate, confidence, and recommendation.
- Add seller actions:
  - publish discount;
  - keep selling;
  - manual review.
- Log recommendation acceptance or rejection.

Deliverables:

- Seller dashboard
- Prediction card
- Recommendation action flow
- Invalid-input and empty-state handling

Gate:

> A tester enters a valid record and reaches a recommendation in under 60 seconds without developer help.

### Phase 4 — Close the student and outcome loop

Date: 27 November

Tasks:

- Build public listing.
- Add claim quantity and pickup reference.
- Add pickup confirmation.
- Add seller closing-outcome form.
- Record sold, discounted, donated, unclaimed, and discarded quantities.
- Calculate rescued portions, discarded portions, recovered revenue, and prediction error.

Deliverables:

- Student listing
- Claim flow
- Outcome form
- Impact dashboard

Gate:

> One seeded scenario completes seller input → prediction → discount → claim → outcome → dashboard in under three minutes.

### Phase 5 — Stabilize, make accessible, deploy

Date: 28 November

Tasks:

- Test the public website from a fresh browser.
- Test mobile width and desktop width.
- Test keyboard navigation.
- Add visible labels, focus states, readable contrast, and clear error messages.
- Add loading, empty, failure, and reset states.
- Add deterministic demo reset.
- Deploy the website.
- Confirm the public GitHub repository works.
- Remove unused dependencies and dead features.

Deliverables:

- Public URL
- Public GitHub repository
- Deployment instructions
- Accessibility checklist
- Bug list with severity

Gate:

> Five consecutive golden-path runs pass after refresh, with no data loss or blocking error.

### Phase 6 — Produce evidence and submission materials

Date: 29 November

Tasks:

- Freeze the feature set by 18:00 WIB.
- Run the evaluation command from a clean environment.
- Capture actual metrics only.
- Draft proposal within the 25-page limit.
- Prepare the five-minute demonstration video.
- Write the originality statement.
- Check that proposal, video, website, and repository describe the same features.
- Record the golden-path demo twice; keep the more reliable take.

Video sequence:

1. Problem and target user — 30 seconds
2. Current failure and proposed intervention — 30 seconds
3. Seller input and prediction — 60 seconds
4. Discount listing and student claim — 60 seconds
5. Outcome logging and impact dashboard — 60 seconds
6. Validation, limitation, and scale path — 40 seconds

Gate:

> Video duration ≤5 minutes; every numerical claim has a dataset, experiment, interview record, or citation.

### Phase 7 — Final verification and submit

Date: 30 November

Tasks:

- Verify the exact official submission time.
- Open the public website in an incognito browser.
- Clone the public repository into a clean directory.
- Run the documented setup or demo command.
- Verify all links.
- Verify proposal page count.
- Verify video duration and title format.
- Verify originality statement.
- Verify team and category information.
- Submit early; retain submission confirmation.
- Do not add features after final verification.

Final gate:

```text
website opens
→ golden path works
→ repository clones
→ proposal fits limit
→ video fits limit
→ originality statement included
→ submission confirmation saved
```

## Definition of done

### Product

- One seller can create a prediction.
- One seller can accept or reject a recommendation.
- One student can claim a discounted item.
- One seller can record the final outcome.
- The dashboard shows impact metrics from the recorded outcome.

### Technical

- Baseline exists.
- Candidate model is compared honestly or removed.
- Test split avoids leakage.
- Invalid input is rejected.
- Low confidence falls back to manual review.
- Demo data can be reset.
- Public deployment works.
- Repository is public and reproducible enough for judging.

### Evidence

- Local problem evidence is separated from global evidence.
- Synthetic data is labeled.
- Results are separated from targets and assumptions.
- No fabricated interviews, users, metrics, or impact.
- Limitations are written.

### Submission

- Website link active.
- GitHub link public.
- Proposal ≤25 pages excluding permitted sections.
- Video ≤5 minutes.
- Originality statement included.
- Latest official announcement checked.

## Team operating model

Assign one owner per workstream. One person may own several streams.

| Workstream | Owner | Output |
|---|---|---|
| Product/research | Team member A | Interviews, problem evidence, proposal claims |
| Data/model | Team member B | Dataset, baseline, evaluation |
| Frontend/workflow | Team member C | Seller, student, dashboard flows |
| QA/deployment | Team member D | Public URL, tests, failure handling |
| Demo/presentation | Team member E | Script, video, Q&A |

Daily rule: each task ends with a visible artifact, not a status message.

## Kill criteria

- No credible dataset by 25 November: remove the learned model; ship the transparent baseline.
- Core seller flow unstable by 26 November: remove donation, auth, and nonessential screens.
- Full loop unstable by 27 November: remove payment, delivery, and all secondary roles.
- Deployment unstable by 28 November: ship a deterministic seeded demo and disclose the limitation.
- Any metric lacks provenance: remove it from the proposal and video.

## After finalist announcement

If shortlisted on 5 December:

- 5 December: freeze the final build and assign Q&A owners.
- 6 December: rehearse the complete demo three times.
- 7 December: test deployment, backup recording, and repository clone.
- 8 December: rehearse technical and problem-defense questions.
- 9 December: final presentation timing and backup plan.
- 10 December: present only the reliable golden path; disclose limitations directly.

Likely Q&A questions:

- Why is prediction necessary instead of a simple rule?
- What is the baseline?
- Where did the data come from?
- How was leakage prevented?
- Does a discount actually reduce waste?
- What happens when the prediction is wrong?
- Who operates and maintains the system?
- Why is this more than a food-sharing marketplace?
- What is original about the closed-loop workflow?
- What remains unvalidated?

## Highest-leverage next action

Complete Phase 0 now: freeze the one golden path and create the deterministic demo fixture.

Pass condition:

> The team can describe, draw, and replay the entire workflow without mentioning any feature outside this roadmap.

## References

- `README.md` — SavePlate MVP definition and data model
- `SEVENT X - Software Development Rulebook.pdf`, pp. 10–16 — deliverables, rubric, timeline, and submission constraints
- United Nations, *The Sustainable Development Goals Report 2026*: https://unstats.un.org/sdgs/files/report/2026/secretary-general-sdg-report-2026--EN.pdf
