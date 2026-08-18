# GEAR - Frontend Architecture

## Stack
- **Framework**: Next.js (App Router) + TypeScript
- **UI**: Tailwind CSS + shadcn/ui
- **Maps**: MapLibre GL / deck.gl
- **Charts**: Recharts

## Component Architecture

```text
apps/web/
├── app/
│   ├── layout.tsx
│   ├── war-room/page.tsx
│   ├── scenario-lab/
│   │   ├── page.tsx
│   │   └── [id]/page.tsx
│   ├── orchestrator/page.tsx
│   ├── strategy-lab/page.tsx
│   └── decision-center/page.tsx
│
├── components/
│   ├── global/ (TopNav.tsx, StatusBar.tsx, CommandHeader.tsx)
│   ├── map/ (EnergyMap.tsx, RouteLayer.tsx, PortLayer.tsx, RiskLayer.tsx, AssetDrawer.tsx)
│   ├── risk/ (RiskScore.tsx, RiskTimeline.tsx, RiskFactors.tsx)
│   ├── scenario/ (ScenarioBuilder.tsx, CascadeGraph.tsx, MonteCarloChart.tsx, ImpactCards.tsx)
│   ├── optimization/ (ActionPlan.tsx, StrategyComparison.tsx, EvidencePanel.tsx, ConfidencePanel.tsx)
│   └── decision/ (ApprovalPanel.tsx, AuditTrail.tsx, ExecutionTimeline.tsx)
│
├── lib/ (api.ts, websocket.ts, utils.ts, constants.ts)
├── hooks/ (useWorldData.ts, useRisk.ts, useScenario.ts, useOptimization.ts, useWebSocket.ts)
└── types/
```

## UI Principles
- **War Room**: Minimal text, high-density visualization, global systemic risk (e.g. 67/100).
- **Decision Center**: Always show Expected Risk Reduction, Cost, Confidence, and clear "WHY" explanations.
