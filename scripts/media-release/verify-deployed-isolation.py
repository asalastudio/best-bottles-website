"""Read-only checks of the fixed review targets and existing production identity."""
from pathlib import Path
import datetime
import hashlib
import json
import subprocess

base = Path("docs/reviews/isolated-preview-deployment-2026-10-20")
seed = json.loads(Path("docs/reviews/isolated-preview-setup-2026-10-20/test-catalog.json").read_text())
node = "/Users/jordanrichter/.hermes/node/bin/node"
vercel = "/Users/jordanrichter/.local/bin/vercel"
team = "team_CGyACzn1BhcZitDAKUiZRzax"
project = "prj_JFb1sYpDTmvfUR2qfOOL9TJmF5yt"
selector = "asala-team:best-bottles-media-review:dev/media-review"
now = datetime.datetime.now(datetime.timezone.utc).isoformat()

def run(args):
    return subprocess.run(args, capture_output=True, text=True, check=True)

def vc(path):
    return json.loads(run([vercel, "api", path + "?teamId=" + team, "--scope", "asala"]).stdout)

def convex(*args):
    return run([node, "node_modules/convex/bin/main.js", *args, "--deployment", selector])

query = ("const tables=" + json.dumps(list(seed)) +
         ";const result={};for(const table of tables)result[table]=await ctx.db.query(table).take(200);return JSON.stringify(result);")
data = json.loads(convex("run", "--inline-query", query, "--codegen", "disable").stdout)
data = json.loads(data) if isinstance(data, str) else data
stable = lambda rows: json.dumps(sorted(rows, key=lambda row: row["_id"]), sort_keys=True, separators=(",", ":"))
checks = {table: {"rows": len(rows), "matchesSeed": stable(rows) == stable(seed[table]),
                  "sha256": hashlib.sha256(stable(rows).encode()).hexdigest()}
          for table, rows in data.items()}
assert set(checks) == set(seed) and all(check["matchesSeed"] for check in checks.values())
spec = json.loads(convex("function-spec").stdout)
assert len(spec["functions"]) == 39 and all(f["functionType"] == "Query" for f in spec["functions"])
environment = convex("env", "list")
assert "No environment variables set" in environment.stdout + environment.stderr
(base / "backend-data-after.json").write_text(json.dumps({
    "checkedAt": now, "url": "https://beloved-wildcat-265.convex.cloud",
    "functions": 39, "readOnly": True, "environmentVariables": 0, "tables": checks,
}, indent=2) + "\n")

p = vc("/v9/projects/" + project)
assert p["accountId"] == team and p.get("link") is None
assert p["ssoProtection"]["deploymentType"] == "all"
env = vc("/v10/projects/" + project + "/env")
expected = {"NEXT_PUBLIC_BB_MEDIA_RELEASE": "off", "NEXT_PUBLIC_REGISTER_STAGE": "on",
            "NEXT_PUBLIC_CONVEX_URL": "https://beloved-wildcat-265.convex.cloud", "NEXT_PUBLIC_CLERK_ENABLED": "false"}
assert {e["key"] for e in env["envs"]} == set(expected)
assert all(e["target"] == ["preview"] for e in env["envs"])
for entry in env["envs"]:
    assert vc("/v1/projects/" + project + "/env/" + entry["id"])["value"] == expected[entry["key"]]
deployments = json.loads((base / "deployments.json").read_text())
for deployment in deployments:
    observed = vc("/v13/deployments/" + deployment["id"])
    assert observed["projectId"] == project and observed["readyState"] == "READY"
    assert observed.get("target") != "production"
    assert observed["meta"]["mediaMode"] == deployment["mode"]
    deployment.update({"readyState": observed["readyState"], "target": observed.get("target"), "verifiedAt": now})
(base / "deployments.json").write_text(json.dumps(deployments, indent=2) + "\n")

before = json.loads((base / "production-observation-before.json").read_text())
production = vc("/v9/projects/" + before["projectId"])["targets"]["production"]
observed = {key: production.get(key) for key in before["production"]}
assert observed == before["production"], "Existing production identity or aliases changed"
remote = run(["git", "ls-remote", "https://github.com/asalastudio/best-bottles-website.git",
              "refs/heads/main", "refs/heads/integration/local-media-main-2026-10-20"]).stdout
refs = {line.split()[1]: line.split()[0] for line in remote.strip().splitlines()}
assert refs["refs/heads/main"] == "c0a861f85b0508304343c4202ccd2fa59c248f53"
assert json.loads(Path("vercel.json").read_text())["git"]["deploymentEnabled"]["integration/local-media-main-2026-10-20"] is False
(base / "production-observation-after.json").write_text(json.dumps({
    "checkedAt": now, "projectId": before["projectId"], "production": observed,
    "remoteMain": refs["refs/heads/main"],
    "remoteReviewBranch": refs["refs/heads/integration/local-media-main-2026-10-20"],
    "reviewProject": {"id": project, "gitConnected": False, "ssoProtection": p["ssoProtection"],
                     "publicPreviewEnvironmentKeys": sorted(expected)},
}, indent=2) + "\n")
print(json.dumps({"seedRows": sum(c["rows"] for c in checks.values()), "queries": 39,
                  "readyPreviewDeployments": len(deployments), "existingProductionUnchanged": True,
                  "remoteMainUnchanged": True}))
