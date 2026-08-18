# GEAR - Development Rules

## 1. Uncertainty & Explainability
- **Rule**: Every important recommendation must contain Probability, Confidence, Assumptions, Data Freshness, Failure Modes, and Alternative Strategies. 

## 2. The Fundamental Principle
- **Rule**: Follow the core loop: Observe → Understand → Predict → Simulate → Optimize → Explain → Decide → Act → Learn. 
- **Rule**: The UI must not be a generic dashboard; it must be a Decision Intelligence platform surfacing the 5 Operating Modes.

## 3. Outbox Pattern is Mandatory
- **Rule**: Do NOT implement distributed transactions between PostgreSQL and Neo4j.
- **Rule**: PostgreSQL is the authoritative transactional source of truth. Updates to Neo4j must happen via background workers consuming from an Outbox table.

## 4. LLM Boundary
- **Rule**: LLMs are strictly for Natural Language Processing (extraction, summarization) and explaining recommendations.
- **Rule**: LLMs MUST NOT make mathematical optimization decisions. Use OR-Tools and Monte Carlo for hard math.

## 5. Redis is Ephemeral
- **Rule**: Redis is NEVER authoritative. Use it only for cache, job queuing, and pub/sub.
