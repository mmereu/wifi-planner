import paramiko
import os
import sys

VPS_HOST = "72.62.48.82"
VPS_USER = "root"
VPS_PASS = "?3+Devagvf0TWbmGCVWn"
REMOTE_BASE = "/opt/hamina"
LOCAL_BASE = "C:/Users/marco.mereu/Hamina"

FILES = [
    ("backend/app/models/models.py",     "backend/app/models/models.py"),
    ("backend/app/schemas/schemas.py",   "backend/app/schemas/schemas.py"),
    ("backend/app/api/floors.py",        "backend/app/api/floors.py"),
    ("backend/app/api/walls.py",         "backend/app/api/walls.py"),
    ("frontend/src/lib/api.js",          "frontend/src/lib/api.js"),
    ("frontend/src/store/useStore.js",   "frontend/src/store/useStore.js"),
    ("frontend/src/lib/heatmap.js",      "frontend/src/lib/heatmap.js"),
    ("frontend/src/components/FloorCanvas.jsx", "frontend/src/components/FloorCanvas.jsx"),
    ("frontend/src/pages/EditorPage.jsx","frontend/src/pages/EditorPage.jsx"),
]

def run_ssh(client, cmd, desc=""):
    print(f"  >> {desc or cmd}")
    stdin, stdout, stderr = client.exec_command(cmd, timeout=300)
    out = stdout.read().decode()
    err = stderr.read().decode()
    rc = stdout.channel.recv_exit_status()
    if out:
        print(out)
    if err:
        print(err, file=sys.stderr)
    return rc

def main():
    print(f"Connecting to {VPS_HOST}...")
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    client.connect(VPS_HOST, username=VPS_USER, password=VPS_PASS, timeout=30)
    print("Connected.\n")

    # Create remote directories
    dirs = set()
    for _, remote_rel in FILES:
        d = os.path.dirname(f"{REMOTE_BASE}/{remote_rel}").replace("\\", "/")
        dirs.add(d)
    run_ssh(client, "mkdir -p " + " ".join(sorted(dirs)), "Creating remote directories")

    # Upload files via SFTP
    sftp = client.open_sftp()
    print("\nUploading files...")
    for local_rel, remote_rel in FILES:
        local_path = os.path.join(LOCAL_BASE, local_rel.replace("/", os.sep))
        remote_path = f"{REMOTE_BASE}/{remote_rel}"
        print(f"  {local_rel} -> {remote_path}")
        sftp.put(local_path, remote_path)
    sftp.close()
    print("All files uploaded.\n")

    # Docker compose rebuild
    print("Rebuilding backend and frontend containers...")
    rc = run_ssh(
        client,
        "cd /opt/hamina && docker compose up -d --build backend frontend 2>&1",
        "docker compose up -d --build backend frontend"
    )
    if rc != 0:
        print(f"WARNING: docker compose build exited with code {rc}", file=sys.stderr)

    # Restart nginx
    print("\nRestarting nginx...")
    rc = run_ssh(
        client,
        "cd /opt/hamina && docker compose restart nginx 2>&1",
        "docker compose restart nginx"
    )
    if rc != 0:
        print(f"WARNING: nginx restart exited with code {rc}", file=sys.stderr)

    # Final status
    print("\nFinal container status:")
    run_ssh(client, "cd /opt/hamina && docker compose ps 2>&1", "docker compose ps")

    client.close()
    print("\nDeployment complete.")

if __name__ == "__main__":
    main()
