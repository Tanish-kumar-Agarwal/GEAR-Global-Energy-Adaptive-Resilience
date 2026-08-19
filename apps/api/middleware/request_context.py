import uuid
import time
from fastapi import Request
from starlette.middleware.base import BaseHTTPMiddleware
from core.logging import request_id_ctx, correlation_id_ctx, get_logger, log_event
import logging

logger = get_logger(__name__)

class RequestContextMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        start_time = time.time()

        # Extract or generate Request ID
        req_id = request.headers.get("X-Request-ID", str(uuid.uuid4()))
        request_id_ctx.set(req_id)

        # Extract or generate Correlation ID
        corr_id = request.headers.get("X-Correlation-ID", str(uuid.uuid4()))
        correlation_id_ctx.set(corr_id)

        response = None
        status_code = 500
        try:
            response = await call_next(request)
            status_code = response.status_code
        except Exception as e:
            # We don't swallow it, we let FastAPI's exception handler deal with it,
            # but we record the failure.
            log_event(logger, logging.ERROR, "api_request_failed", 
                      method=request.method,
                      route=request.url.path,
                      error_type=type(e).__name__)
            raise
        finally:
            duration_ms = int((time.time() - start_time) * 1000)
            
            # Log the API Latency
            log_event(logger, logging.INFO, "api_request_completed",
                      method=request.method,
                      route=request.url.path,
                      status_code=status_code,
                      duration_ms=duration_ms)
            
            if response:
                response.headers["X-Request-ID"] = req_id
                response.headers["X-Correlation-ID"] = corr_id

        return response
