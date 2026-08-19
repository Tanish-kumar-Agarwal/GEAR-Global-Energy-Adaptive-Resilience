import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))))

from graph.queries.digital_twin import get_geopolitical_events_affecting_node, get_risk_scores_for_node

def verify():
    print("=== VERIFYING GRAPH PROJECTION ===")
    
    events = get_geopolitical_events_affecting_node("CHK_HORMUZ")
    print(f"\nEvents affecting CHK_HORMUZ: {len(events)}")
    for e in events:
        print(f"- {e['Title']} (Severity: {e['Severity']})")
        
    risks = get_risk_scores_for_node("CHK_HORMUZ")
    print(f"\nRisk scores for CHK_HORMUZ: {len(risks)}")
    for r in risks:
        print(f"- Score: {r['Score']} | Level: {r['Level']}")

if __name__ == "__main__":
    verify()
