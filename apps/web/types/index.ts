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

export interface DataIntelligenceSource {
  name: string;
  status: string;
  statusColor: string;
  sync: string;
  time: string;
  records: string;
  metricValue: number;
  rel: string;
  relColor: string;
  detail?: string;
}

export interface DataIntelligenceSourcesResponse {
  sources: DataIntelligenceSource[];
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

export interface RadarDataPoint {
  subject: string;
  baseline?: number;
  optimized?: number;
  fullMark?: number;
  A?: number;
  B?: number;
}

export interface MasterResponseOption {
  option_id: string;
  option_type: string;
  name: string;
  description: string;
  feasibility: string;
  expected_effect: Record<string, unknown>;
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
    risk_reduction?: string;
    price_impact_oil?: string;
    price_impact_lng?: string;
    reserve_depletion?: string;
    shipping_cost?: string;
  };
  radar_data?: RadarDataPoint[];
  options: MasterResponseOption[];
  optimization: {
    status?: string;
    allocation?: Array<{ destination_id: string; volume_allocated: number; supplier_id: string; route_id: string }>;
    reserve_usage?: { total_drawdown?: number };
    objective?: { baseline_shortage?: number; optimized_shortage?: number; improvement?: number };
    [key: string]: any;
  };
  recommendation: {
    recommendation_id: string;
    action_type: string;
    recommended_action: string;
    priority: string;
    expected_physical_impact: { shortage?: number | string; [key: string]: any };
    expected_economic_impact: { loss?: string; total?: string | number; [key: string]: any };
    optimization_status: string;
    primary_drivers: string[];
    action_plan?: {
      optimization?: {
        allocation?: Array<{ destination_id: string; volume_allocated: number; supplier_id: string; route_id: string }>;
        reserve_usage?: { total_drawdown?: number };
      };
    };
    [key: string]: any;
  };
  explanation: {
    causal_chain?: Array<{ cause: string; effect: string }>;
    primary_drivers?: string[];
    [key: string]: any;
  };
  approval: {
    status?: string;
    decision_version?: string;
    [key: string]: any;
  };
  alternatives: Array<{ strategy?: string; feasibility?: string; shortage?: string | number; [key: string]: any }>;
  uncertainty: {
    sample_count?: number;
    P10?: { supply_gap?: number };
    P50?: { supply_gap?: number };
    P90?: { supply_gap?: number };
    [key: string]: any;
  };
  assumptions: Array<Record<string, any>>;
  provenance: Array<Record<string, any>>;
  decision_audit: { decision_id?: string; [key: string]: any } | null;
}

export type DisasterType = 'CYCLONE' | 'FLOOD' | 'EARTHQUAKE' | 'WILDFIRE' | 'VOLCANO' | 'DROUGHT' | 'TSUNAMI' | 'NATURAL_HAZARD';

export type DisasterAlertLevel = 'Red' | 'Orange' | 'Green';

export interface DisasterEvent {
  id: string;
  event_id: number;
  event_type: DisasterType;
  raw_type: string;
  name: string;
  description: string;
  alert_level: DisasterAlertLevel;
  alert_score: number;
  lat: number;
  lng: number;
  country: string;
  from_date: string;
  to_date: string;
  severity_text: string;
  report_url: string;
  threatened_chokepoints?: string[];
}

export interface DisastersResponse {
  status: string;
  count: number;
  data: DisasterEvent[];
  is_live: boolean;
  source: string;
}

export interface DisastersSummaryResponse {
  status: string;
  total_active_disasters: number;
  is_live_feed: boolean;
  counts_by_type: Record<string, number>;
  counts_by_alert_level: Record<string, number>;
  critical_energy_threats: Array<{
    disaster_name: string;
    event_type: string;
    alert_level: string;
    chokepoints: string[];
  }>;
  provenance: {
    source: string;
    authority: string;
    sync_frequency: string;
    is_live: boolean;
  };
}
