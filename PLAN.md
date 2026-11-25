# SavePlate

Predictive food-surplus management for campus cafeterias.

## One-line concept

SavePlate predicts which cafeteria items are likely to remain unsold, recommends a timely discount, lets students claim the surplus, and records the final outcome.

## Problem

Food waste creates environmental, social, and financial losses. The United Nations reported that 1.05 billion tonnes of food were wasted at retail, food-service, and household levels in 2022—19% of available food. Food loss and waste were associated with up to 10% of global greenhouse-gas emissions and approximately $1 trillion in annual economic losses.[1]

The global statistic establishes urgency. It does not prove the size of the problem at our target campus. Local validation is required before making campus-level impact claims.

## MVP objective

Reduce edible portions discarded by one campus cafeteria through one measurable intervention: a limited-time discount for predicted surplus food.

Primary user: cafeteria seller.

Secondary user: student buyer.

MVP boundary: one cafeteria, one campus, one food category, one prediction workflow, one discount flow.

## MVP loop

```text
Seller input
    ↓
Surplus prediction
    ↓
Recommendation shown
    ↓
Seller accepts or rejects discount
    ↓
Discounted item published
    ↓
Student claims item
    ↓
Pickup confirmed
    ↓
Closing outcome recorded
    ↓
Waste and revenue impact measured
    ↓
Outcome becomes training data for future predictions
```

The loop is complete only when the final outcome is recorded. A prediction without an intervention is analytics. A listing without outcome tracking is only a marketplace.

## Detailed workflow

### 1. Seller records the situation

Required inputs:

- Food item or category
- Planned quantity
- Quantity sold so far
- Quantity remaining
- Current price
- Hours until closing or expiry
- Date and day of week
- Event or holiday flag

Manual entry is intentional. It keeps the MVP deployable without special hardware.

### 2. The system predicts surplus

The model estimates:

- Expected additional demand
- Expected surplus quantity
- Confidence or risk level
- Recommended action

Example:

```text
Current stock: 30 portions
Expected additional demand: 18 portions
Estimated surplus: 12 portions
Confidence: 82%
Recommendation: discount 8 portions for 60 minutes
```

The system recommends. The seller remains responsible for the decision.

### 3. The seller chooses an action

MVP actions:

- Publish limited-time discount
- Keep selling normally
- Manual review

Optional later action:

- Assign surplus to a verified donation partner

No automatic disposal, pricing, donation, or health-related decision is allowed.

### 4. The student claims the item

The student:

1. Opens the available listing.
2. Selects a quantity.
3. Receives a pickup reference.
4. Collects the item.
5. Confirms pickup.

Payment and delivery integrations are outside the MVP. Cash-on-pickup or simulated payment is sufficient for the competition prototype.

### 5. The seller records the outcome

At closing, the seller records quantities that were:

- Sold normally
- Sold through discount
- Donated
- Unclaimed
- Discarded

This is the most important feedback step. Without it, the system cannot measure impact or learn from prediction errors.

### 6. The system measures impact

Dashboard outputs:

- Edible portions rescued
- Edible portions discarded
- Rescue rate
- Recovered revenue
- Prediction error
- Seller action acceptance rate
- Daily and weekly trends

Primary impact metric:

```text
Edible portions discarded per operating day
```

User-value metrics:

```text
Recovered revenue per operating day
Discounted portions claimed / discounted portions published
```

Do not use account count, page views, or prediction count as proof of impact.

## Hypothetical example

This example is illustrative, not a measured result.

- 30 portions remain at 16:00.
- The model predicts 18 additional sales.
- Estimated surplus: 12 portions.
- The seller publishes 8 discounted portions.
- Students claim 6 portions.
- Two portions remain unclaimed.
- The seller records the final outcome.

The system can now compare its prediction with reality and calculate rescued, unclaimed, and discarded quantities.

## Screen flow

1. Seller dashboard
   - Current stock
   - Sales so far
   - Closing time
   - Active alerts

2. Prediction card
   - Expected demand
   - Estimated surplus
   - Confidence
   - Recommended action

3. Action screen
   - Discount
   - Keep selling
   - Manual review

4. Public listing
   - Item
   - Quantity
   - Discount
   - Pickup deadline

5. Claim confirmation
   - Quantity
   - Pickup reference
   - Status

6. Closing outcome
   - Sold
   - Claimed
   - Donated
   - Discarded

7. Impact dashboard
   - Waste trend
   - Rescue rate
   - Recovered revenue
   - Prediction error

## AI design

### Baseline

```text
Expected demand = average demand for the same food category and weekday
```

### Candidate model

Start with a small regression or tree-based model using:

- Day of week
- Historical sales
- Planned quantity
- Current sales
- Current stock
- Price
- Hours until closing
- Event or holiday flag

### Required comparison

The candidate model must be compared with the baseline using mean absolute error (MAE) on a held-out test set.

```text
MAE = average absolute difference between predicted and actual demand
```

No model performance result is claimed yet. Results must come from the project dataset and reproducible evaluation.

## Minimal data model

```text
daily_record
- seller_id
- date
- item
- planned_quantity
- sold_quantity
- remaining_quantity
- discarded_quantity

prediction
- daily_record_id
- predicted_demand
- predicted_surplus
- confidence
- recommendation

intervention
- prediction_id
- type
- quantity
- status

outcome
- intervention_id
- claimed_quantity
- donated_quantity
- unclaimed_quantity
- discarded_quantity
- recovered_revenue
```

## Failure behavior

| Failure | MVP behavior |
|---|---|
| Missing history | Use the weekday-average baseline |
| Low model confidence | Show manual review |
| No student claim | Mark unclaimed; seller decides next action |
| No donation partner | Disable donation; retain discount/manual review |
| Network interruption | Preserve unsent form data locally where possible |
| Incorrect prediction | Record error; do not hide it |
| Seller rejects recommendation | Log rejection and continue normal selling |

## Deliberate scope

### Build now

- Seller workflow
- Student listing and claim flow
- One surplus prediction model
- Baseline comparison
- Discount intervention
- Pickup confirmation
- Closing outcome logging
- Impact dashboard
- Public deployment
- Public GitHub repository

### Skip for the MVP

- Payment gateway
- Delivery logistics
- Multi-campus marketplace
- Computer vision
- IoT weighing scale
- Chatbot
- Automated disposal
- Complex dynamic pricing
- Donation logistics without a real partner

A smaller closed loop is more valuable than a broad application with no measurable outcome.

## Competition demonstration

Golden-path demo:

1. Seller enters historical and current sales data.
2. SavePlate predicts surplus.
3. Seller accepts the discount recommendation.
4. Student claims a portion.
5. Seller confirms the closing outcome.
6. Dashboard displays rescued portions, discarded portions, recovered revenue, and prediction error.

Target demo duration: under three minutes.

Use a deterministic demo fixture or replayable dataset. Keep live data as a secondary path, not the only path.

The SEVENT X Software Development rulebook prioritizes theme alignment, functionality and code implementation, innovation and originality, problem urgency, and UI/UX/accessibility. It also requires a deployable website or installable mobile application, public GitHub repository, proposal, originality statement, and demonstration video. The local rulebook specifies a proposal limit of 25 pages and a demonstration video limit of 5 minutes. Verify the latest official announcement before submission. Source: `SEVENT X - Software Development Rulebook.pdf`, pp. 10–16.

## Validation plan

1. Interview at least five cafeteria sellers or food-service operators.
2. Measure one week of planned, sold, remaining, and discarded portions.
3. Build the weekday-average baseline.
4. Train and evaluate the candidate model without data leakage.
5. Compare baseline and model MAE.
6. Run a simulated discount intervention.
7. Test whether users complete the full loop without assistance.
8. Report limitations separately from measured results.

Pass condition:

> One tester completes seller input → prediction → discount → claim → closing outcome → impact dashboard in under three minutes.

## Limitations

- Synthetic data cannot prove real waste reduction.
- Prediction quality may vary by menu, season, events, and seller behavior.
- A discount may shift purchases rather than reduce total waste.
- The MVP measures portions, not exact weight or carbon impact.
- Food safety, expiry rules, pricing law, and donation procedures require local review.
- Seller adoption and student pickup behavior remain unproven until user testing.

## Sources

[1] United Nations, *The Sustainable Development Goals Report 2026*: https://unstats.un.org/sdgs/files/report/2026/secretary-general-sdg-report-2026--EN.pdf

Local competition source: `SEVENT X - Software Development Rulebook.pdf`, pp. 10–16.
