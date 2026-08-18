# GEAR - AI & ML Architecture

## The Explainable AI Pipeline Rule
The LLM is NOT the source of truth.

```text
REAL DATA → STRUCTURED DATA → KNOWLEDGE GRAPH → DIGITAL TWIN → SIMULATION → OPTIMIZATION → RECOMMENDATION → LLM → EXPLANATION
```

## Responsibilities
- **ML**: Prediction (Risk, Demand)
- **Graph**: Dependencies
- **Simulation**: Cascades + uncertainty
- **Optimization**: Best decision
- **LLM**: Explanation + natural-language interface

## Folder Structure
```text
ml/
├── nlp/
│   ├── event_extraction/ (LLM / NLP)
│   └── entity_resolution/ (Embeddings + similarity + rules)
├── risk/
│   └── risk_prediction/ (XGBoost / LightGBM)
├── forecasting/
│   └── demand_forecasting/ (XGBoost / time-series models)
└── economic_impact/ (Econometric / ML model)
```

## Risk Engine
Risk is not a flat "HIGH/LOW". It is dimensional:
- **Time/Probability**: 7 Days (8%), 30 Days (21%), 90 Days (37%).
- **Confidence**: 71%
- **Dimensions**: Geopolitical, Supply, Logistics, Infrastructure, Market, Financial, Climate, Cyber, Regulatory, Demand.
