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
  ExplainabilityResponse,
  DataIntelligenceSourcesResponse
} from '../types';

import { DATA_MODE, DEMO_AUTO_LOGIN, DEMO_CREDENTIALS } from './config';
import * as snapshot from '../data/snapshot';
import {
  fallbackLiveRoutes,
  fallbackLiveChokepoints,
  fallbackSupplyChainStatus,
} from './live-adapters';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1';
const LIVE_TIMEOUT_MS = 8000;

// Snapshot-mode simulation state: remembers the last created scenario so the
// results poll can answer with numbers matching the user's inputs, and returns
// RUNNING for the first poll so the lab visibly simulates.
let snapshotScenario = { targetId: 'CHK_HORMUZ', severity: 0.7, duration: 30, polls: 0 };

// Snapshot payloads, used two ways: as the entire data source in
// HACKATHON_SNAPSHOT mode, and as the per-request fallback in LIVE mode when
// the backend cannot be reached. Returns undefined for endpoints that have no
// snapshot equivalent (those surface their live errors).
function snapshotResponse(endpoint: string, options?: RequestInit): unknown {
  if (endpoint === '/scenarios' && options?.method === 'POST') {
    const body = JSON.parse(String(options.body ?? '{}'));
    snapshotScenario = {
      targetId: body.target_id ?? 'CHK_HORMUZ',
      severity: body.severity ?? 0.7,
      duration: body.duration_days ?? 30,
      polls: 0,
    };
    return { id: 'SCN-SNAPSHOT-001', message: 'Scenario created (snapshot mode)' };
  }
  if (/^\/scenarios\/[^/]+\/run$/.test(endpoint)) {
    return { job_id: 'JOB-SNAPSHOT-001', status: 'QUEUED' };
  }
  if (/^\/scenarios\/[^/]+\/results$/.test(endpoint)) {
    snapshotScenario.polls++;
    if (snapshotScenario.polls < 2) {
      return { scenario_id: 'SCN-SNAPSHOT-001', job_status: 'RUNNING', results: null };
    }
    return {
      scenario_id: 'SCN-SNAPSHOT-001',
      job_status: 'COMPLETED',
      results: snapshot.buildHackathonScenarioResults(
        snapshotScenario.targetId, snapshotScenario.severity, snapshotScenario.duration,
      ),
    };
  }
  if (endpoint === '/world/overview') return snapshot.HACKATHON_WORLD_OVERVIEW;
  if (endpoint === '/risks/evaluation') return snapshot.HACKATHON_RISK_EVALUATION;
  if (endpoint.startsWith('/risks/trend')) return snapshot.HACKATHON_RISK_TREND;
  if (endpoint.startsWith('/world/assets')) return snapshot.HACKATHON_MAP_ASSETS;
  if (endpoint.startsWith('/world/routes')) return fallbackLiveRoutes();
  if (endpoint.startsWith('/world/chokepoints')) return fallbackLiveChokepoints();
  if (endpoint.startsWith('/world/supply-chain-status')) return fallbackSupplyChainStatus();
  if (endpoint.startsWith('/risks/exposures')) return { status: 'ok' };
  // Empty regions make the heatmap fall back to its locally derived scores.
  if (endpoint.startsWith('/risks/heatmap')) return { status: 'ok', regions: [] };
  if (endpoint.startsWith('/risks/categories')) {
    return {
      status: 'ok',
      categories: [
        { label: 'Geopolitical Risk', score: 72, trend: 'UP', level: 'HIGH', status: 'ok' },
        { label: 'Logistics Risk', score: 61, trend: 'FLAT', level: 'MEDIUM', status: 'ok' },
        { label: 'Supply Risk', score: 42, trend: 'DOWN', level: 'LOW', status: 'ok' },
        { label: 'Market Risk', score: 32, trend: 'DOWN', level: 'LOW', status: 'ok' },
      ],
    };
  }
  if (endpoint.startsWith('/market/prices')) {
    return {
      status: 'ok',
      prices: [
        { name: 'Brent Crude', price: 64.82, change_pct: 2.35 },
        { name: 'WTI Crude', price: 61.47, change_pct: 2.18 },
        { name: 'LNG (JKM)', price: 12.34, change_pct: 1.92 },
        { name: 'Coal (API2)', price: 104.6, change_pct: -0.45 },
      ],
    };
  }
  if (endpoint.startsWith('/market/reserve-coverage')) {
    return { status: 'ok', countries: [{ country_id: 'IND', status: 'ok', coverage_days: 9.8, target_days: 90 }] };
  }
  if (endpoint.startsWith('/market/balance-timeseries')) {
    return {
      status: 'ok',
      series: snapshot.HACKATHON_SUPPLY_BALANCE.map(p => ({
        date: p.date, supply_mbd: p.Supply, demand_mbd: p.Demand, at_risk_mbd: p.AtRisk,
      })),
    };
  }
  if (endpoint.startsWith('/intelligence/events')) return snapshot.HACKATHON_INTEL_EVENTS;
  if (endpoint.startsWith('/graph/dependencies')) return snapshot.HACKATHON_GRAPH_DEPENDENCIES;
  if (endpoint.startsWith('/health/components')) return { status: 'healthy', ...snapshot.HACKATHON_SYSTEM_HEALTH };
  // Strategy Lab flows, backed by payloads captured from real backend runs.
  if (endpoint === '/strategy/options') return snapshot.HACKATHON_STRATEGY_OPTIONS;
  if (endpoint === '/strategy/scenarios' && options?.method === 'POST') {
    return { strategy_id: 'STRAT-SNAPSHOT-001', status: 'QUEUED' };
  }
  if (/^\/strategy\/scenarios\/[^/]+$/.test(endpoint)) return snapshot.HACKATHON_STRATEGY_RESULT;
  if (endpoint === '/optimization/procurement' && options?.method === 'POST') {
    return { job_id: 'JOB-OPT-SNAPSHOT-001', status: 'QUEUED' };
  }
  if (/^\/optimization\/[^/]+$/.test(endpoint)) return snapshot.HACKATHON_OPTIMIZATION_RESULT;
  if (endpoint.startsWith('/decisions/pending')) return [];
  // Empty live-sources list: the data-intelligence page then renders its own
  // static source catalog without touching the network.
  if (endpoint.startsWith('/intelligence/data-sources')) return { sources: [] };
  return undefined;
}

// ---------------------------------------------------------------------------
// Fallback visibility: whenever a LIVE request silently serves snapshot data,
// the UI must be able to say so. Pages subscribe and render a warning badge.
// ---------------------------------------------------------------------------
type FallbackListener = (endpoints: string[]) => void;
const fallbackEndpoints = new Set<string>();
const fallbackListeners = new Set<FallbackListener>();

export function subscribeSnapshotFallback(cb: FallbackListener): () => void {
  fallbackListeners.add(cb);
  cb([...fallbackEndpoints]);
  return () => { fallbackListeners.delete(cb); };
}

function noteFallback(endpoint: string) {
  fallbackEndpoints.add(endpoint);
  fallbackListeners.forEach(cb => cb([...fallbackEndpoints]));
}

// A live success clears the endpoint's fallback flag, so the badge disappears
// as soon as real data is flowing again instead of sticking forever.
function noteLiveSuccess(endpoint: string) {
  if (fallbackEndpoints.delete(endpoint)) {
    fallbackListeners.forEach(cb => cb([...fallbackEndpoints]));
  }
}

// One login at a time; every caller awaits the same promise.
let loginPromise: Promise<string | null> | null = null;

async function demoLogin(): Promise<string | null> {
  if (!DEMO_AUTO_LOGIN || typeof window === 'undefined') return null;
  if (!loginPromise) {
    loginPromise = (async () => {
      try {
        const form = new URLSearchParams(DEMO_CREDENTIALS);
        const res = await fetch(`${API_BASE}/auth/token`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: form.toString(),
        });
        if (!res.ok) return null;
        const data = await res.json();
        localStorage.setItem('gear_token', data.access_token);
        return data.access_token as string;
      } catch {
        return null;
      } finally {
        loginPromise = null;
      }
    })();
  }
  return loginPromise;
}

export class ApiClient {
  private static async request<T>(endpoint: string, options?: RequestInit): Promise<T> {
    if (DATA_MODE === 'HACKATHON_SNAPSHOT') {
      const canned = snapshotResponse(endpoint, options);
      if (canned !== undefined) return canned as T;
    }

    try {
      const result = await this.liveRequest<T>(endpoint, options);
      noteLiveSuccess(endpoint);
      return result;
    } catch (err) {
      const canned = snapshotResponse(endpoint, options);
      if (canned !== undefined) {
        console.warn(`[api] live request failed for ${endpoint}, serving snapshot fallback`, err);
        noteFallback(endpoint);
        return canned as T;
      }
      throw err;
    }
  }

  private static async liveRequest<T>(endpoint: string, options?: RequestInit, retried = false, timeoutMs = LIVE_TIMEOUT_MS): Promise<T> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...((options?.headers as Record<string, string>) || {}),
    };

    // No eager login: the DEBUG backend needs no token at all. A 401 below
    // triggers the demo login exactly when the backend actually wants auth.
    if (typeof window !== 'undefined') {
      const token = localStorage.getItem('gear_token');
      if (token) headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(`${API_BASE}${endpoint}`, {
      ...options,
      headers,
      signal: AbortSignal.timeout(timeoutMs),
    });

    if (response.status === 401) {
      if (typeof window !== 'undefined') {
        localStorage.removeItem('gear_token');
        // Expired or bad token: mint a fresh demo token once, then retry.
        if (!retried && (await demoLogin())) {
          return this.liveRequest<T>(endpoint, options, true, timeoutMs);
        }
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

  static async getWorldRoutes(): Promise<import('./live-adapters').LiveRoute[]> {
    return this.request<import('./live-adapters').LiveRoute[]>('/world/routes');
  }

  static async getWorldChokepoints(): Promise<import('./live-adapters').LiveChokepoint[]> {
    return this.request<import('./live-adapters').LiveChokepoint[]>('/world/chokepoints');
  }

  // Graph Digital Twin
  static async getGraphDependencies(entityType: string, entityId: string): Promise<any> {
    return this.request<any>(`/graph/dependencies/${entityType}/${entityId}`);
  }

  // Scenarios
  static async createScenario(data: ScenarioCreateRequest): Promise<ScenarioCreateResponse> {
    // Mirror the params into the snapshot sim state so a mid-flow fallback
    // (live create succeeds, later steps fail) still answers with matching numbers.
    snapshotScenario = {
      targetId: data.target_id ?? 'CHK_HORMUZ',
      severity: data.severity ?? 0.7,
      duration: data.duration_days ?? 30,
      polls: 0,
    };
    return this.request<ScenarioCreateResponse>('/scenarios', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  static async runScenario(scenarioId: string): Promise<JobQueuedResponse> {
    const endpoint = `/scenarios/${scenarioId}/run`;
    if (DATA_MODE === 'HACKATHON_SNAPSHOT') {
      return this.request<JobQueuedResponse>(endpoint, { method: 'POST' });
    }
    try {
      return await this.liveRequest<JobQueuedResponse>(endpoint, { method: 'POST' });
    } catch {
      try {
        // Queue down (503): ask the API to run the simulation inline. Inline
        // Monte Carlo takes a while, so give it a much longer window.
        return await this.liveRequest<JobQueuedResponse>(`${endpoint}?sync_fallback=true`, { method: 'POST' }, false, 90000);
      } catch (err) {
        console.warn('[api] live scenario run failed, serving snapshot fallback', err);
        noteFallback(endpoint);
        return snapshotResponse(endpoint, { method: 'POST' }) as JobQueuedResponse;
      }
    }
  }

  static async getScenarioResults(scenarioId: string): Promise<ScenarioJobStatus> {
    return this.request<ScenarioJobStatus>(`/scenarios/${scenarioId}/results`);
  }

  // Live severity preview. Deliberately NOT routed through request(): a
  // preview must never fall back to snapshot data. Outcomes:
  //   {data}            live estimate from the backend
  //   {notImplemented}  endpoint not deployed yet (404/405/501), caller may stub
  //   null              transient failure or abort, caller keeps last good state
  static async previewScenario(
    body: { target_id: string; severity: number; duration_days: number },
    signal?: AbortSignal,
  ): Promise<{ data?: import('./live-adapters').ScenarioPreview; notImplemented?: boolean } | null> {
    if (DATA_MODE === 'HACKATHON_SNAPSHOT') return { notImplemented: true };
    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (typeof window !== 'undefined') {
        const token = localStorage.getItem('gear_token');
        if (token) headers['Authorization'] = `Bearer ${token}`;
      }
      const signals = [AbortSignal.timeout(LIVE_TIMEOUT_MS)];
      if (signal) signals.push(signal);
      const response = await fetch(`${API_BASE}/scenarios/preview`, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
        signal: AbortSignal.any(signals),
      });
      if ([404, 405, 501].includes(response.status)) return { notImplemented: true };
      if (!response.ok) return null;
      return { data: await response.json() };
    } catch {
      return null;
    }
  }

  // Strategy Lab
  static async getStrategyOptions(): Promise<any> {
    return this.request<any>('/strategy/options');
  }

  static async createStrategyScenario(data: { name: string; baseline_scenario_id: string; levers: { type: string; target_id: string }[] }): Promise<any> {
    return this.request<any>('/strategy/scenarios', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  static async getStrategyScenario(id: string): Promise<any> {
    return this.request<any>(`/strategy/scenarios/${id}`);
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

  static async getDataIntelligenceSources(): Promise<DataIntelligenceSourcesResponse> {
    return this.request<DataIntelligenceSourcesResponse>('/intelligence/data-sources');
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
