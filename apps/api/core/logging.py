import logging
import json
import traceback
from datetime import datetime, timezone
import contextvars

# Context variables to hold request scope data
request_id_ctx = contextvars.ContextVar("request_id", default=None)
correlation_id_ctx = contextvars.ContextVar("correlation_id", default=None)
user_id_ctx = contextvars.ContextVar("user_id", default=None)

def set_correlation_id(corr_id: str):
    correlation_id_ctx.set(corr_id)

def get_correlation_id() -> str:
    return correlation_id_ctx.get()

class StructuredJsonFormatter(logging.Formatter):
    def format(self, record):
        log_record = {
            "timestamp": datetime.fromtimestamp(record.created, tz=timezone.utc).isoformat(),
            "level": record.levelname,
            "service": "gear-api",
            "name": record.name,
            "message": record.getMessage(),
        }

        # Inject context variables if available
        req_id = request_id_ctx.get()
        if req_id:
            log_record["request_id"] = req_id
            
        corr_id = correlation_id_ctx.get()
        if corr_id:
            log_record["correlation_id"] = corr_id
            
        uid = user_id_ctx.get()
        if uid:
            log_record["user_id"] = uid

        # Inject extra fields passed via `extra={...}`
        if hasattr(record, 'extra_data'):
            log_record.update(record.extra_data)

        if record.exc_info:
            log_record["exception"] = "".join(traceback.format_exception(*record.exc_info))
            log_record["error_type"] = record.exc_info[0].__name__

        return json.dumps(log_record)

def setup_logging():
    logger = logging.getLogger()
    logger.setLevel(logging.INFO)
    
    # Remove existing handlers to avoid duplicates
    for handler in logger.handlers[:]:
        logger.removeHandler(handler)
        
    handler = logging.StreamHandler()
    handler.setFormatter(StructuredJsonFormatter())
    logger.addHandler(handler)

    # Silence noisy loggers
    logging.getLogger("uvicorn.access").setLevel(logging.WARNING)
    logging.getLogger("neo4j").setLevel(logging.WARNING)

def get_logger(name):
    return logging.getLogger(name)

# Helper function to log with extra data easily
def log_event(logger, level, event_name, **kwargs):
    extra = {"extra_data": {"event": event_name, **kwargs}}
    if level == logging.INFO:
        logger.info(event_name, extra=extra)
    elif level == logging.WARNING:
        logger.warning(event_name, extra=extra)
    elif level == logging.ERROR:
        logger.error(event_name, extra=extra)
    elif level == logging.DEBUG:
        logger.debug(event_name, extra=extra)
