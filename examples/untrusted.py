# Pretend an agent wrote this. It pokes at its surroundings and reports what it finds.
# It reads nothing secret and changes nothing; it only reports.
import os, platform, socket, getpass

print("kernel:", platform.release())
print("hostname:", socket.gethostname())
try:
    print("user:", getpass.getuser())
except Exception:
    print("user: (unknown)")

# Your laptop's environment is not here. List variable NAMES only, never values.
names = sorted(os.environ)
print("env var names:", ", ".join(names) if names else "(none)")
suspicious = [n for n in names if any(k in n for k in ("AWS", "GITHUB", "OPENAI", "ANTHROPIC", "SANDSCALE"))]
print("credential-looking variables:", suspicious or "none")

# Your home directory is not here either.
for p in ("~/.ssh", "~/.aws", "~/.config/gh"):
    print(f"{p} exists:", os.path.exists(os.path.expanduser(p)))

# Network: what this sandbox can reach depends on your plan and your egress allowlist.
try:
    socket.create_connection(("example.com", 443), timeout=3).close()
    print("network: example.com:443 reachable")
except OSError as e:
    print("network: example.com:443 not reachable:", type(e).__name__)
