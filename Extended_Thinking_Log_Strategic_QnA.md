

# Extended Thinking Log — Strategic Q&A (Pre-MVP)

> ⚠️ This section documents strategic thoughts discussed before MVP completion.  
> These are NOT part of current implementation scope.

---

## Q1. Could this service be sold to MetaMask directly?

**Short Answer:**  
Unlikely in a direct marketplace sense.

**Clarification:**
- MetaMask is not an app marketplace.
- Realistic paths:
  - Integration via MetaMask Snaps
  - API subscription (B2B model)
  - Long-term acquisition scenario (rare, high bar)

**Conclusion:**  
More realistic to become infrastructure/API provider rather than “sell inside MetaMask.”

---

## Q2. If the service grows, what is the realistic monetization path?

**Possible Models:**
1. Public web interface (free)
2. API with rate limits
3. Paid API key (Pro plan)
4. B2B integration licensing
5. Data analytics layer (future)

**Core Insight:**  
Value comes from accumulated vote data, not UI.

---

## Q3. Should early voters receive a token reward?

**Original Idea:**
- Voting participation rewarded with token
- Token burned on registration
- Incentivize community engagement

**Concern Identified:**
- Incentives may distort voting behavior
- Encourages Sybil attacks
- Attracts speculators instead of signal contributors

**Revised View:**
- Avoid token incentives in Phase 1
- Build signal integrity first
- Consider token only after meaningful data accumulation

---

## Q4. What about Sybil attacks (multiple wallets voting)?

**Reality:**
- Impossible to fully prevent in EVM systems
- Wallet creation cost is near zero

**Important Distinction:**
- Without token rewards → attacker gains nothing except distortion
- With token rewards → attacker gains direct profit

**Strategic Approach:**

Phase 1:
- Accept 1 wallet = 1 vote
- Monitor anomalies

Future options:
- Wallet age weighting
- On-chain activity scoring
- Reputation-based influence
- Stake-weighted voting (advanced)

---

## Q5. What is the core value of the system?

Two possibilities:

1. Participation platform
2. Trust signal layer

**Chosen Direction:**  
Trust signal layer.

The system does not determine truth.  
It surfaces community consensus.

---

## Q6. Is tokenization required for growth?

**Insight:**  
Tokens accelerate growth.  
They do not create growth.

Premature tokenization often:
- Attracts low-quality actors
- Introduces governance complexity
- Damages data credibility

**Decision:**  
Tokenization deferred until meaningful network effects emerge.

---

## Q7. What creates long-term defensibility?

Not:
- UI
- Feature count
- Chain support

But:
- Accumulated consensus dataset
- Reputation graph
- Historical vote data
- External API usage

Defensibility = Data gravity.

---

## Q8. What is the current priority?

Not:
- DAO design
- Tokenomics
- B2B modeling
- Snap integration

Current Priority:  
Ship MVP.  
Accumulate real vote data.

---

# Strategic Reminder

> Business strategy is future leverage.  
> MVP completion is present leverage.

This document preserves expansion thinking  
without allowing it to derail implementation.