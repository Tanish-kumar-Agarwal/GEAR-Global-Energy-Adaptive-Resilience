import os
import sys

# Add the apps/api directory to the python path so we can import from core/models
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from core.database import SessionLocal
from services.ingestion import IngestionService, DeterministicDemoAdapter

def run_ingestion():
    print("==================================================")
    print("STARTING DETERMINISTIC INGESTION DEMO")
    print("==================================================")
    
    db = SessionLocal()
    try:
        adapter = DeterministicDemoAdapter()
        service = IngestionService(db, adapter)
        
        stats = service.run_ingestion()
        
        print("\nINGESTION REPORT:")
        print(f"Events received:       {stats['received']}")
        print(f"Events accepted:       {stats['accepted']}")
        print(f"Events rejected:       {stats['rejected']}")
        print(f"Entities resolved:     {stats['resolved']}")
        print(f"Entities unresolved:   {stats['unresolved']}")
        print(f"Risk scores created:   {stats['risk_scores_created']}")
        print(f"Outbox events created: {stats['outbox_events_created']}")
        print("\nDONE.")
        
    finally:
        db.close()

if __name__ == "__main__":
    run_ingestion()
