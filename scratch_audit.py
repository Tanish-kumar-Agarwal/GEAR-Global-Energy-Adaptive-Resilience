import sys
import os

sys.path.append(os.getcwd())
sys.path.append(os.path.join(os.getcwd(), 'apps', 'api'))

try:
    from graph.neo4j_client import neo4j_client
    from apps.api.workers.tasks import execute_scenario_simulation
except Exception as e:
    print(f"Error importing: {e}")
    sys.exit(1)

# Get baseline counts
def get_counts():
    try:
        res = neo4j_client.execute_read("MATCH (n) RETURN count(n) as node_count")
        if res:
            return res[0]['node_count']
        return 0
    except Exception as e:
        return f"Error: {e}"

before = get_counts()

# Run scenario A
try:
    execute_scenario_simulation(None, "test_job_1", "CHK_HORMUZ", 0.5)
except Exception as e:
    print(f"Scenario A failed: {e}")
after_a = get_counts()

# Run scenario B
try:
    execute_scenario_simulation(None, "test_job_2", "CHK_MALACCA", 0.8)
except Exception as e:
    print(f"Scenario B failed: {e}")
after_b = get_counts()

print(f"BEFORE: {before}")
print(f"AFTER A: {after_a}")
print(f"AFTER B: {after_b}")
