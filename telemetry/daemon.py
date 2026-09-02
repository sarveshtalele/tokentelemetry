#!/usr/bin/env python3
import os, time
from telemetry.reconcile import reconcile

INTERVAL = max(2, int(os.environ.get("CLAUDE_TELEMETRY_INTERVAL", "5")))

def main():
    print(f"Claude Token Telemetry daemon: polling every {INTERVAL}s. Ctrl+C to stop.")
    while True:
        try:
            changed, _ = reconcile()
            if changed:
                print(f"Updated {changed} transcript(s).")
        except KeyboardInterrupt:
            print("Stopped.")
            return
        except Exception as exc:
            print(f"Reconcile error: {exc}")
        time.sleep(INTERVAL)

if __name__ == "__main__":
    main()
