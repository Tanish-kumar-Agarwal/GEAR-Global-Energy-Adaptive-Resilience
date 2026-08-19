import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from workers.projection_worker import process_outbox_events

def run():
    print("Triggering projection worker (sync)...")
    process_outbox_events()
    print("Done projecting.")

if __name__ == "__main__":
    run()
