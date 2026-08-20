import { useState, useEffect } from 'react';
import { ApiClient } from './api';
import { ScenarioJobStatus } from '../types';

export function useJobPolling(jobId: string | null, scenarioId: string | null) {
  const [status, setStatus] = useState<'QUEUED' | 'RUNNING' | 'COMPLETED' | 'FAILED' | null>(null);
  const [results, setResults] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!jobId || !scenarioId) return;

    let intervalId: NodeJS.Timeout;

    let attempts = 0;
    const MAX_ATTEMPTS = 40; // 60 seconds at 1.5s interval

    const poll = async () => {
      attempts++;
      if (attempts > MAX_ATTEMPTS) {
         setError('Job polling timed out.');
         clearInterval(intervalId);
         return;
      }
      try {
        const response = await ApiClient.getScenarioResults(scenarioId);
        setStatus(response.job_status);
        
        if (response.job_status === 'COMPLETED') {
          setResults(response.results);
          clearInterval(intervalId);
        } else if (response.job_status === 'FAILED') {
          setError('Job failed during simulation.');
          clearInterval(intervalId);
        }
      } catch (err: any) {
        setError(err.message);
        clearInterval(intervalId);
      }
    };

    // Initial poll
    poll();
    
    // Set up polling interval
    intervalId = setInterval(poll, 1500);

    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [jobId, scenarioId]);

  return { status, results, error };
}
