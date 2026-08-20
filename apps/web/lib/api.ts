import { 
  WorldOverview, 
  ScenarioCreateRequest, 
  ScenarioCreateResponse, 
  JobQueuedResponse, 
  ScenarioJobStatus,
  OptimizationResult,
  DecisionRecord,
  DecisionResponse,
  RiskTrendResponse,
  RiskExposureResponse,
  RiskEvaluationResponse,
  IntelligenceEventsResponse,
  ExplainabilityResponse
} from '../types';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1';

export class ApiClient {
  private static async request<T>(endpoint: string, options?: RequestInit): Promise<T> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...((options?.headers as Record<string, string>) || {}),
    };

    if (typeof window !== 'undefined') {
      const token = localStorage.getItem('gear_token');
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
    }

    const response = await fetch(`${API_BASE}${endpoint}`, {
      ...options,
      headers,
    });

    if (response.status === 401) {
      if (typeof window !== 'undefined') {
        localStorage.removeItem('gear_token');
        window.location.href = '/login';
      }
      throw new Error('Unauthorized');
    }

    if (!response.ok) {
      throw new Error(`API Error: ${response.statusText}`);
    }

    return response.json() as Promise<T>;
  }

  // World / War Room
  static async getWorldOverview(): Promise<WorldOverview> {
    return this.request<WorldOverview>('/world/overview');
  }

  static async getSupplyChainStatus(): Promise<any> {
    return this.request<any>('/world/supply-chain-status');
  }

  static async getWatchlistAssets(): Promise<any> {
    return this.request<any>('/world/assets?sort=risk');
  }

  // Graph Digital Twin
  static async getGraphDependencies(entityType: string, entityId: string): Promise<any> {
    return this.request<any>(`/graph/dependencies/${entityType}/${entityId}`);
  }

  // Scenarios
  static async createScenario(data: ScenarioCreateRequest): Promise<ScenarioCreateResponse> {
    return this.request<ScenarioCreateResponse>('/scenarios', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  static async runScenario(scenarioId: string): Promise<JobQueuedResponse> {
    return this.request<JobQueuedResponse>(`/scenarios/${scenarioId}/run`, {
      method: 'POST',
    });
  }

  static async getScenarioResults(scenarioId: string): Promise<ScenarioJobStatus> {
    return this.request<ScenarioJobStatus>(`/scenarios/${scenarioId}/results`);
  }

  // Optimization
  static async runProcurementOptimization(scenarioId: string): Promise<OptimizationResult> {
    return this.request<OptimizationResult>('/optimization/procurement', {
      method: 'POST',
      body: JSON.stringify({ scenario_id: scenarioId }),
    });
  }

  static async getOptimizationResult(jobId: string): Promise<any> {
    return this.request<any>(`/optimization/${jobId}`);
  }

  // Decisions
  static async getPendingDecisions(): Promise<any[]> {
    return this.request<any[]>('/decisions/pending');
  }

  static async getDecision(id: string): Promise<any> {
    return this.request<any>(`/decisions/${id}`);
  }


  // MARKET & ECONOMICS
  static async getEconomicImpact(scenarioId: string) {
    return this.request(`/market/economic-impact?scenario_id=${scenarioId}`);
  }
  
  static async getMarketReserveCoverage(): Promise<any> {
    return this.request<any>('/market/reserve-coverage');
  }
  
  static async getMarketPrices(): Promise<any> {
    return this.request<any>('/market/prices');
  }
  
  static async getMarketBalanceTimeseries(): Promise<any> {
    return this.request<any>('/market/balance-timeseries');
  }

  // Risks
  static async getRiskTrend(entityId?: string): Promise<RiskTrendResponse> {
    const query = entityId ? `?entity_id=${entityId}` : '';
    return this.request<RiskTrendResponse>(`/risks/trend${query}`);
  }

  static async getRiskExposures(entityId: string): Promise<RiskExposureResponse> {
    return this.request<RiskExposureResponse>(`/risks/exposures?entity_id=${entityId}`);
  }

  static async getRiskEvaluation(): Promise<RiskEvaluationResponse> {
    return this.request<RiskEvaluationResponse>('/risks/evaluation');
  }

  static async getRiskCategories(): Promise<any> {
    return this.request<any>('/risks/categories');
  }

  static async getRiskHeatmap(): Promise<any> {
    return this.request<any>('/risks/heatmap');
  }

  // Intelligence
  static async getIntelligenceEvents(limit: number = 5): Promise<IntelligenceEventsResponse> {
    return this.request<IntelligenceEventsResponse>(`/intelligence/events?limit=${limit}`);
  }

  static async getIntelligenceExplainability(riskId: string): Promise<ExplainabilityResponse> {
    return this.request<ExplainabilityResponse>(`/intelligence/explainability?risk_id=${riskId}`);
  }

  static async getScenarioExplainability(scenarioId: string): Promise<any> {
    return this.request<any>(`/intelligence/explainability/scenario/${scenarioId}`);
  }

  // Health
  static async getHealthComponents(): Promise<any> {
    return this.request<any>('/health/components');
  }
  // Response Orchestrator
  static async getMasterResponse(scenarioId: string): Promise<import('../types').MasterResponseObject> {
    return this.request<import('../types').MasterResponseObject>(`/response/` + scenarioId);
  }

  static async approveDecision(scenarioId: string, comment?: string): Promise<any> {
    return this.request<any>(`/decisions/${scenarioId}/approve`, { 
      method: 'POST',
      body: JSON.stringify({ comment })
    });
  }

  static async rejectDecision(scenarioId: string, reason: string, comment?: string): Promise<any> {
    return this.request<any>(`/decisions/${scenarioId}/reject`, { 
      method: 'POST',
      body: JSON.stringify({ reason, comment })
    });
  }

  static async reviewDecision(scenarioId: string, reason: string, comment?: string): Promise<any> {
    return this.request<any>(`/decisions/${scenarioId}/review`, {
      method: 'POST',
      body: JSON.stringify({ reason, comment })
    });
  }
  
  static async getDecisionAudit(scenarioId: string): Promise<any[]> {
    return this.request<any[]>(`/decisions/${scenarioId}/audit`);
  }
}
