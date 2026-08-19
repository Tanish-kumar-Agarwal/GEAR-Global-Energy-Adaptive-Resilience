export interface WorldOverview {
  active_nodes: number;
  active_edges: number;
  systemic_risk: number;
  supply_stress: number;
  status?: string;
  recent_events?: IntelligenceEvent[];
}

export interface ScenarioCreateRequest {
  name: string;
  target_id: string;
  chokepoint_id?: string;
  severity: number;
  duration_days: number;
}

export interface ScenarioCreateResponse {
  id: string;
  message: string;
}

export interface JobQueuedResponse {
  job_id: string;
  status: string;
}

export interface MonteCarloResult {
  p10_gap: number;
  p50_gap: number;
  p90_gap: number;
  mean_gap: number;
  iterations: number;
}

export interface ScenarioResult {
  monte_carlo: MonteCarloResult;
  affected_routes: string[];
  cascade_impact: string;
}

export interface ScenarioJobStatus {
  scenario_id: string;
  job_status: 'QUEUED' | 'RUNNING' | 'COMPLETED' | 'FAILED';
  results: ScenarioResult | null;
}

export interface OptimizationResult {
  status: string;
  job_id: string;
  recommendation: {
    total_estimated_cost: number;
    procurement_plan: Record<string, number>;
    shortage_risk: Record<string, number>;
  };
}

export interface DecisionRecord {
  scenario_id?: string;
  recommendation_id?: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'REQUEST_REVIEW';
  action_plan: Record<string, any>;
}

export interface DecisionResponse {
  decision_id: string;
  status: string;
  timestamp: string;
}

export interface IntelligenceEvent {
  id: string;
  title: string;
  type: string;
  severity: number;
  confidence: number;
  timestamp: string;
  location: string;
}

export interface RiskTrendPoint {
  timestamp: string;
  score: number;
  level: string;
}

export interface RiskTrendResponse {
  status: string;
  data: RiskTrendPoint[];
}

export interface IntelligenceEventsResponse {
  status: string;
  data: IntelligenceEvent[];
}

export interface RiskExposureEntity {
  id: string;
  name: string;
}

export interface RiskExposureResponse {
  status: string;
  dependent_countries: RiskExposureEntity[];
  exposed_suppliers: RiskExposureEntity[];
  routes_affected: RiskExposureEntity[];
  downstream_assets: RiskExposureEntity[];
}

export interface RiskEvaluationResponse {
  status: string;
  systemic_risk_score: number;
  active_critical_risks: number;
  active_high_risks: number;
  event_count: number;
  highest_severity_event: string | null;
}

export interface ExplainabilityResponse {
  status: string;
  primary_drivers: string[];
  contributing_events: IntelligenceEvent[];
}

export interface MasterResponseObject {
  status: string;
  problem: {
    problem_id: string;
    scenario_id: string;
    target: string;
    severity: number;
    duration_days: number;
    status: string;
  };
  impact: {
    supply_gap: number | null;
    economic_impact_total: string;
    p10_gap: number | null;
    p50_gap: number | null;
    p90_gap: number | null;
    affected_routes: number;
    affected_assets: number;
    affected_countries: number;
  };
  options: {
    option_id: string;
    option_type: string;
    name: string;
    description: string;
    feasibility: string;
    expected_effect: Record<string, any>;
  }[];
  optimization: Record<string, any>;
  recommendation: {
    recommendation_id: string;
    action_type: string;
    recommended_action: string;
    priority: string;
    expected_physical_impact: Record<string, any>;
    expected_economic_impact: Record<string, any>;
    optimization_status: string;
    primary_drivers: string[];
  };
  explanation: Record<string, any>;
  approval: Record<string, any>;
  alternatives: Record<string, any>[];
  uncertainty: Record<string, any>;
  assumptions: Record<string, any>[];
  provenance: Record<string, any>[];
  decision_audit: Record<string, any> | null;
}
