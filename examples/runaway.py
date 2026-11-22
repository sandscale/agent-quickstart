# Pretend an agent wrote an infinite loop. The run timeout in sandscale.config.json
# (runTimeoutSeconds) ends it, and the sandbox is stopped either way.
import time
n = 0
while True:
    n += 1
    if n % 5 == 0:
        print("still running", n, flush=True)
    time.sleep(1)
