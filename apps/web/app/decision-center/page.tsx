'use client';

import { useState, useEffect, Suspense } from 'react';
import { Loader2, Search, CheckCircle2, XCircle, Clock, AlertTriangle, MessageSquare } from 'lucide-react';
import { ApiClient } from '@/lib/api';
import { useSearchParams, useRouter } from 'next/navigation';
import type { MasterResponseObject } from '@/types';

function DecisionCenterContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  
  // NOTE: In the previous flow, "decision_id" in the URL was actually pointing to either a scenario ID or an audit ID.
  // We align with scenario_id as the primary reference for this UI.
  const initialScenarioId = searchParams.get('scenario_id') || searchParams.get('decision_id');
  
  const [loading, setLoading] = useState(false);
  const [scenarioId, setScenarioId] = useState<string | null>(initialScenarioId);
  const [status, setStatus] = useState<string | null>(null);
  const [pendingDecisions, setPendingDecisions] = useState<any[]>([]);
  const [responseObj, setResponseObj] = useState<MasterResponseObject | null>(null);
  const [auditHistory, setAuditHistory] = useState<any[]>([]);

  // Dialog State
  const [actionDialog, setActionDialog] = useState<'APPROVE' | 'REJECT' | 'REVIEW' | null>(null);
  const [reason, setReason] = useState('');
  const [comment, setComment] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const fetchPending = async () => {
    try {
      const data = await ApiClient.getPendingDecisions();
      setPendingDecisions(data);
    } catch(e) {
      console.error(e);
    }
  };

  const fetchAuditHistory = async (sid: string) => {
     try {
       const history = await ApiClient.getDecisionAudit(sid);
       setAuditHistory(history);
       if (history.length > 0) {
         setStatus(history[0].status); // first is latest
       } else {
         setStatus('PENDING');
       }
     } catch(e) {
       console.error(e);
     }
  };

  useEffect(() => {
    fetchPending();
  }, []);

  useEffect(() => {
    if (scenarioId) {
      ApiClient.getMasterResponse(scenarioId).then(res => {
         setResponseObj(res);
      }).catch(console.error);
      fetchAuditHistory(scenarioId);
    }
  }, [scenarioId]);

  const submitAction = async () => {
    if (!scenarioId || !actionDialog) return;
    if ((actionDialog === 'REJECT' || actionDialog === 'REVIEW') && !reason.trim()) {
      setErrorMsg('Reason is required.');
      return;
    }

    setLoading(true);
    setErrorMsg('');
    try {
      if (actionDialog === 'APPROVE') await ApiClient.approveDecision(scenarioId, comment);
      if (actionDialog === 'REJECT') await ApiClient.rejectDecision(scenarioId, reason, comment);
      if (actionDialog === 'REVIEW') await ApiClient.reviewDecision(scenarioId, reason, comment);
      
      setActionDialog(null);
      setReason('');
      setComment('');
      
      await fetchAuditHistory(scenarioId);
      await fetchPending();
    } catch(e: any) {
      console.error(e);
      setErrorMsg('Action failed. Ensure the package is not stale and transition is valid.');
    } finally {
      setLoading(false);
    }
  };

  const rec = responseObj?.recommendation;

  const renderDataUnavailable = () => <div className="text-xs text-slate-500 font-bold uppercase">DATA UNAVAILABLE</div>;

  return (
    <div className="h-full min-h-[850px] min-w-[1280px] w-full bg-[#0f181b] p-3 flex gap-3 text-slate-300 font-sans relative">
      
      {/* LEFT COLUMN: PENDING DECISIONS */}
      <div className="w-[300px] flex flex-col gap-3 flex-shrink-0 bg-[#182227] rounded-md border border-slate-700/50 overflow-y-auto no-scrollbar shadow-sm">
        <div className="p-3 border-b border-slate-700/50 font-medium text-[11px] uppercase tracking-wider text-slate-400 bg-slate-800/50">
          Pending Reviews
        </div>
        <div className="p-4 flex flex-col gap-3">
          <div className="relative mb-2">
            <Search className="absolute left-2 top-2 h-3.5 w-3.5 text-slate-500" />
            <input type="text" placeholder="Search scenarios..." className="w-full bg-[#0f181b] border border-slate-700 rounded p-2 pl-7 text-xs text-slate-300" />
          </div>
          
          {pendingDecisions.length > 0 ? (
             pendingDecisions.map((pd, idx) => (
                <div 
                   key={idx}
                   onClick={() => { setScenarioId(pd.scenario_id); router.push(`/decision-center?scenario_id=${pd.scenario_id}`); }}
                   className={`flex border rounded p-2 items-start cursor-pointer transition-colors ${scenarioId === pd.scenario_id ? 'bg-[#182227] border-blue-500' : 'bg-[#0f181b] border-blue-900/50'}`}
                >
                  <div className="w-6 h-6 rounded bg-slate-800 text-blue-400 flex items-center justify-center shrink-0 mr-3 mt-0.5"><AlertTriangle size={12} /></div>
                  <div className="flex-1 min-w-0">
                     <div className="text-xs font-bold text-slate-200 truncate">Decision Request</div>
                     <div className="text-[9px] text-slate-400 mt-1 truncate">{pd.scenario_id.substring(0, 8)}...</div>
                  </div>
                  <div className="flex gap-4 shrink-0 px-2 text-[9px] text-amber-400 font-bold uppercase mt-1">{pd.status}</div>
                </div>
             ))
          ) : (
             <div className="text-xs text-slate-500 text-center mt-4">No pending decisions.</div>
          )}
        </div>
      </div>

      {/* CENTER COLUMN: RECOMMENDATION DETAILS */}
      <div className="flex-1 flex flex-col gap-3 min-w-0">
        
        {/* HEADER */}
        <div className="bg-[#182227] rounded-md border border-slate-700/50 p-4 shadow-sm flex items-center justify-between">
           <div>
              <h2 className="text-lg font-bold text-slate-200 uppercase tracking-widest">Decision Center</h2>
              <div className="text-[11px] text-slate-400 mt-1">{scenarioId ? `Scenario ID: ${scenarioId}` : 'Select a decision package'}</div>
           </div>
           {scenarioId && (
             <div className="flex items-center gap-2 border border-slate-600 bg-slate-800/50 px-3 py-1.5 rounded">
               <span className="text-[10px] text-slate-400">Current Status:</span>
               <span className={`text-[10px] font-bold uppercase ${status === 'APPROVED' ? 'text-emerald-400' : status === 'REJECTED' ? 'text-red-400' : 'text-amber-400'}`}>[{status}]</span>
             </div>
           )}
        </div>

         {/* MIDDLE SECTION */}
        <div className="flex gap-3 h-[320px] flex-shrink-0">
           {/* PROPOSED ACTIONS */}
           <div className="w-[55%] bg-[#182227] rounded-md border border-slate-700/50 p-4 shadow-sm flex flex-col relative">
              <h3 className="text-[11px] font-bold tracking-wider text-slate-400 uppercase mb-4">Recommended Action</h3>
              <div className="flex flex-col gap-2 overflow-y-auto">
                 {responseObj?.optimization?.allocation && responseObj.optimization.allocation.length > 0 ? (
                    responseObj.optimization.allocation.map((alloc: any, idx: number) => (
                       <div key={idx} className="bg-[#0f181b] p-3 rounded border border-slate-700/50">
                          <div className="text-xs font-bold text-slate-200 mb-1">Route to {alloc.destination_id}</div>
                          <div className="text-[10px] text-slate-400">Procure {alloc.volume_allocated.toFixed(2)} units from {alloc.supplier_id} via route {alloc.route_id}.</div>
                       </div>
                    ))
                 ) : (
                    <div className="text-xs text-slate-500">No optimization actions proposed.</div>
                 )}
                 {Boolean(responseObj?.optimization?.reserve_usage?.total_drawdown && responseObj.optimization.reserve_usage.total_drawdown > 0) && (
                   <div className="bg-[#0f181b] p-3 rounded border border-slate-700/50">
                      <div className="text-xs font-bold text-slate-200 mb-1">Reserve Drawdown</div>
                      <div className="text-[10px] text-slate-400">Draw {responseObj?.optimization?.reserve_usage?.total_drawdown} units from storage.</div>
                   </div>
                 )}
              </div>
           </div>

           {/* ALTERNATIVES */}
           <div className="flex-1 bg-[#182227] rounded-md border border-slate-700/50 p-4 shadow-sm relative overflow-y-auto">
              <h3 className="text-[11px] font-bold tracking-wider text-slate-400 uppercase mb-4">Alternatives Considered</h3>
              {responseObj?.alternatives?.length ? responseObj.alternatives.map((alt: { strategy?: string; feasibility?: string; shortage?: string | number }, i: number) => (
                 <div key={i} className="flex flex-col gap-1 text-xs border-b border-slate-700 pb-2 mb-2 last:border-0">
                    <div className="font-bold text-slate-200">{alt.strategy}</div>
                    <div className="text-slate-400">Feasibility: <span className="uppercase text-slate-300">{alt.feasibility}</span></div>
                    <div className="text-slate-400">Result Shortage: {alt.shortage !== undefined ? alt.shortage : renderDataUnavailable()}</div>
                 </div>
              )) : <div className="text-xs text-slate-500">NO ADDITIONAL VALIDATED ALTERNATIVES</div>}
           </div>
        </div>

        {/* BOTTOM SECTION */}
        <div className="flex gap-3 flex-1 min-h-[160px]">
           {/* EVIDENCE & LOGIC */}
           <div className="w-[55%] bg-[#182227] rounded-md border border-slate-700/50 p-4 relative flex flex-col overflow-y-auto">
              <h3 className="text-[11px] font-bold tracking-wider text-slate-400 uppercase mb-4">Provenance & Logic Chain</h3>
              {responseObj?.explanation?.causal_chain && responseObj.explanation.causal_chain.length > 0 ? (
                <div className="space-y-2">
                  {responseObj.explanation.causal_chain.map((c: { cause?: string; effect?: string }, i: number) => (
                    <div key={i} className="text-xs bg-slate-900 border border-slate-800 p-2 rounded">
                      <span className="text-amber-500 font-bold">CAUSE:</span> {c.cause} <br />
                      <span className="text-blue-500 font-bold">EFFECT:</span> {c.effect}
                    </div>
                  ))}
                </div>
              ) : renderDataUnavailable()}
           </div>

           {/* CONFIDENCE & UNCERTAINTY */}
           <div className="flex-1 bg-[#182227] rounded-md border border-slate-700/50 p-4 relative flex flex-col overflow-y-auto">
              <h3 className="text-[11px] font-bold tracking-wider text-slate-400 uppercase mb-4">Uncertainty Bounds</h3>
              {responseObj?.uncertainty?.sample_count ? (
                 <div className="flex flex-col gap-2">
                    <div className="text-xs text-slate-300 font-bold uppercase text-emerald-400">Statistical bounds achieved</div>
                    <div className="text-[10px] text-slate-500 mb-2">Samples: {String(responseObj.uncertainty.sample_count)}</div>
                    <div className="text-xs text-slate-400">P10 Shortage: {responseObj.uncertainty.P10?.supply_gap !== undefined ? String(responseObj.uncertainty.P10.supply_gap) : 'N/A'}</div>
                    <div className="text-xs text-slate-400">P50 Shortage: {responseObj.uncertainty.P50?.supply_gap !== undefined ? String(responseObj.uncertainty.P50.supply_gap) : 'N/A'}</div>
                    <div className="text-xs text-slate-400">P90 Shortage: {responseObj.uncertainty.P90?.supply_gap !== undefined ? String(responseObj.uncertainty.P90.supply_gap) : 'N/A'}</div>
                 </div>
              ) : (
                <div className="text-xs text-slate-400 italic">P10/P50/P90: {renderDataUnavailable()}</div>
              )}
           </div>
        </div>

        {/* BOTTOM APPROVE BAR */}
        <div className="h-16 bg-[#182227] rounded-md border border-slate-700/50 px-4 flex items-center justify-between shrink-0 shadow-sm">
           <div className="flex items-center gap-6">
              <div className="text-[11px] font-bold text-slate-400 uppercase">Human Governance Control</div>
           </div>
           <div className="flex items-center gap-3">
              <button 
                onClick={() => setActionDialog('REVIEW')}
                disabled={loading || !scenarioId || (status === 'APPROVED' || status === 'REJECTED')} 
                className="px-4 py-2 rounded text-xs font-bold bg-amber-900/40 border border-amber-600/50 text-amber-300 hover:bg-amber-800/60 disabled:opacity-30 disabled:cursor-not-allowed uppercase tracking-wider"
              >
                Request Review
              </button>
              <button 
                onClick={() => setActionDialog('REJECT')}
                disabled={loading || !scenarioId || (status === 'APPROVED' || status === 'REJECTED')} 
                className="px-4 py-2 rounded text-xs font-bold bg-red-900/40 border border-red-600/50 text-red-300 hover:bg-red-800/60 disabled:opacity-30 disabled:cursor-not-allowed uppercase tracking-wider"
              >
                Reject
              </button>
              <button 
                onClick={() => setActionDialog('APPROVE')}
                disabled={loading || !scenarioId || (status === 'APPROVED' || status === 'REJECTED')} 
                className="px-5 py-2 rounded text-xs font-bold bg-emerald-600 text-white hover:bg-emerald-500 disabled:opacity-30 disabled:cursor-not-allowed uppercase tracking-wider shadow-lg shadow-emerald-950"
              >
                Approve
              </button>
           </div>
        </div>

      </div>

      {/* RIGHT COLUMN: IMPACT & AUDIT HISTORY */}
      <div className="w-[300px] flex flex-col gap-3 flex-shrink-0 overflow-y-auto no-scrollbar">
        
        {/* PHYSICAL IMPACT */}
        <div className="bg-[#182227] rounded-md border border-slate-700/50 p-4 shadow-sm flex flex-col relative min-h-[140px]">
          <h3 className="text-[10px] font-bold tracking-wider text-slate-400 uppercase mb-4 border-b border-slate-700/50 pb-2">Expected Physical Impact</h3>
          {responseObj?.impact ? (
            <div className="text-xs text-slate-300 space-y-3">
              <div>
                <div className="text-[10px] text-slate-500 uppercase">Baseline Shortage</div>
                <div className="text-lg text-red-400 font-bold">{responseObj.impact.supply_gap ?? renderDataUnavailable()}</div>
              </div>
              <div>
                <div className="text-[10px] text-slate-500 uppercase">Optimized Shortage</div>
                <div className="text-lg text-emerald-400 font-bold">{rec?.expected_physical_impact?.shortage !== undefined ? String(rec.expected_physical_impact.shortage) : renderDataUnavailable()}</div>
              </div>
            </div>
          ) : renderDataUnavailable()}
        </div>
        
        {/* ECONOMIC IMPACT */}
        <div className="bg-[#182227] rounded-md border border-slate-700/50 p-4 shadow-sm flex flex-col relative min-h-[140px]">
          <h3 className="text-[10px] font-bold tracking-wider text-slate-400 uppercase mb-4 border-b border-slate-700/50 pb-2">Expected Economic Impact</h3>
          {responseObj?.impact ? (
            <div className="text-xs text-slate-300 space-y-3">
              <div>
                <div className="text-[10px] text-slate-500 uppercase">Baseline Loss</div>
                <div className="text-lg text-red-400 font-bold">
                    {responseObj.impact.economic_impact_total !== 'data_unavailable' && responseObj.impact.economic_impact_total !== undefined 
                      ? `$${responseObj.impact.economic_impact_total}` 
                      : renderDataUnavailable()}
                </div>
              </div>
              <div>
                <div className="text-[10px] text-slate-500 uppercase">Avoided Loss</div>
                <div className="text-lg text-emerald-400 font-bold">
                    {rec?.expected_economic_impact?.avoided_loss !== 'data_unavailable' && rec?.expected_economic_impact?.avoided_loss !== undefined 
                      ? `$${rec.expected_economic_impact.avoided_loss}` 
                      : renderDataUnavailable()}
                </div>
              </div>
            </div>
          ) : renderDataUnavailable()}
        </div>

        {/* AUDIT TIMELINE */}
        <div className="bg-[#182227] rounded-md border border-slate-700/50 p-4 shadow-sm flex flex-col relative flex-1">
          <h3 className="text-[10px] font-bold tracking-wider text-slate-400 uppercase mb-4 border-b border-slate-700/50 pb-2">Decision Audit History</h3>
          <div className="flex flex-col gap-3 overflow-y-auto">
             {auditHistory.length > 0 ? auditHistory.map((a, i) => (
                 <div key={a.id} className="text-[10px] bg-[#0f181b] border border-slate-700/50 rounded p-2 relative">
                     {i !== auditHistory.length - 1 && <div className="absolute left-[13px] top-[26px] bottom-[-16px] w-[1px] bg-slate-700"></div>}
                     <div className="flex items-center gap-2 mb-1">
                        <div className={`w-3 h-3 rounded-full shrink-0 ${a.status === 'APPROVED' ? 'bg-emerald-500' : a.status === 'REJECTED' ? 'bg-red-500' : 'bg-amber-500'}`}></div>
                        <div className="font-bold text-slate-300">{a.status}</div>
                        <div className="text-slate-500 ml-auto">{new Date(a.timestamp).toLocaleString()}</div>
                     </div>
                     <div className="text-slate-400 mb-1"><span className="text-slate-500">Actor:</span> {a.actor_id}</div>
                     {a.reason && <div className="text-amber-400/80"><span className="text-slate-500">Reason:</span> {a.reason}</div>}
                     {a.comment && <div className="text-blue-400/80 italic mt-1"><MessageSquare size={10} className="inline mr-1" />{a.comment}</div>}
                 </div>
             )) : (
                 <div className="text-xs text-slate-500 italic">NO DECISION HISTORY</div>
             )}
          </div>
        </div>

      </div>

      {/* DIALOGS */}
      {actionDialog && (
          <div className="absolute inset-0 bg-black/60 z-50 flex flex-col items-center justify-center backdrop-blur-sm">
             <div className="bg-[#182227] border border-slate-600 rounded-lg shadow-2xl p-6 w-[450px]">
                 <h2 className="text-lg font-bold text-slate-200 mb-2 uppercase tracking-wide">
                     {actionDialog === 'APPROVE' ? 'Confirm Approval' : actionDialog === 'REJECT' ? 'Reject Decision' : 'Send for Review'}
                 </h2>
                 
                 {actionDialog === 'APPROVE' && (
                     <div className="text-xs text-amber-300/80 bg-amber-900/20 border border-amber-800 p-3 rounded mb-4">
                         You are about to APPROVE this decision. This action will be recorded permanently in Decision Audit.
                     </div>
                 )}

                 {(actionDialog === 'REJECT' || actionDialog === 'REVIEW') && (
                     <div className="mb-4">
                         <label className="block text-xs font-bold text-slate-400 mb-1">Reason <span className="text-red-400">*</span></label>
                         <select 
                           value={reason} 
                           onChange={e => setReason(e.target.value)}
                           className="w-full bg-[#0f181b] border border-slate-700 rounded p-2 text-xs text-slate-200 focus:border-blue-500 outline-none"
                         >
                             <option value="">Select reason...</option>
                             <option value="Insufficient Evidence">Insufficient Evidence</option>
                             <option value="Unacceptable Risk">Unacceptable Risk</option>
                             <option value="Stale Data">Stale Data / Needs Refresh</option>
                             <option value="Alternative Strategy Required">Alternative Strategy Required</option>
                             <option value="Manual Intervention">Manual Intervention Chosen</option>
                         </select>
                     </div>
                 )}

                 <div className="mb-4">
                     <label className="block text-xs font-bold text-slate-400 mb-1">Additional Comment (Optional)</label>
                     <textarea 
                        value={comment}
                        onChange={e => setComment(e.target.value)}
                        className="w-full h-20 bg-[#0f181b] border border-slate-700 rounded p-2 text-xs text-slate-200 focus:border-blue-500 outline-none resize-none"
                     ></textarea>
                 </div>

                 {errorMsg && <div className="text-red-400 text-xs mb-4 font-bold">{errorMsg}</div>}

                 <div className="flex justify-end gap-3 mt-6">
                     <button 
                        onClick={() => { setActionDialog(null); setErrorMsg(''); setReason(''); setComment(''); }}
                        className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold rounded"
                        disabled={loading}
                     >
                         CANCEL
                     </button>
                     <button 
                        onClick={submitAction}
                        disabled={loading}
                        className={`px-4 py-2 text-white text-xs font-bold rounded flex items-center gap-2 ${
                            actionDialog === 'APPROVE' ? 'bg-emerald-600 hover:bg-emerald-500' :
                            actionDialog === 'REJECT' ? 'bg-red-600 hover:bg-red-500' :
                            'bg-blue-600 hover:bg-blue-500'
                        }`}
                     >
                         {loading && <Loader2 className="animate-spin" size={14} />}
                         CONFIRM {actionDialog}
                     </button>
                 </div>
             </div>
          </div>
      )}

    </div>
  );
}

export default function DecisionCenter() {
  return (
    <Suspense fallback={<div className="p-8 text-white">Loading Decision Center...</div>}>
      <DecisionCenterContent />
    </Suspense>
  );
}
