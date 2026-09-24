# Wastios DevOps Setup

This document explains, from a DevOps point of view, the minimal end-to-end toolchain
added on top of the existing Wastios application (Node/Express backend, Vite/React
frontend, FastAPI ml_service). The application code itself was not restructured —
everything DevOps-related lives under `devops/`, plus three small additions to the app:
`backend/Dockerfile`, `frontend/Dockerfile`, and a `/metrics` route in the backend.

## Why Maven isn't in the pipeline

The originally requested flow started with Maven, but there is no Java code anywhere in
this repo. Maven was dropped (confirmed with the repo owner) and the pipeline's build
stage uses `npm`/`pip` instead — the native build tools for the actual services.

## Architecture

```
   ┌────────────┐   ┌─────────────┐   ┌───────┐   ┌────────┐   ┌───────┐
   │  Checkout   │→ │ npm/pip build│→ │SonarQube│→ │ Trivy  │→ │ Docker │
   └────────────┘   └─────────────┘   └───────┘   └────────┘   └───────┘
                                                                     │
                                                                     ▼
                                                              ┌────────────┐
                                                              │ Nexus (OCI) │
                                                              └────────────┘
                                                                     │
                                        git commit values.yaml ◄─────┘
                                                 │
                                                 ▼
                                        ┌────────────────┐
                                        │  GitHub (repo)  │
                                        └────────────────┘
                                                 │  Argo CD watches
                                                 ▼
                          ┌─────────────────────────────────────────┐
                          │  Minikube (Kubernetes)                    │
                          │  Helm chart → backend/frontend/ml_service  │
                          │  ingress-nginx → routes traffic            │
                          └─────────────────────────────────────────┘
                                                 │
                    ┌────────────────────────────┼───────────────────────────┐
                    ▼                            ▼                           ▼
             Prometheus (scrape)          Loki + Promtail (logs)      Alertmanager (alerts)
                    │
                    ▼
                Grafana (dashboards, both datasources)
```

Terraform provisions the local support services (SonarQube, Nexus, and two local
stand-ins for Firebase/S3 — see below) as plain Docker containers. Ansible verifies the
CLI toolchain is installed and configures Jenkins (credentials + the pipeline job) via
its REST API. Everything after "Docker Build" is genuine GitOps: Jenkins never talks to
the cluster directly to deploy — it only pushes an image and commits a new tag; Argo CD
is the only thing that touches the cluster.

## Tool-by-tool: what it does here

| Tool | Role | How to reach it |
|---|---|---|
| Terraform | Provisions SonarQube, Nexus, Firestore emulator, S3 mock as Docker containers | `devops/terraform/` |
| Ansible | Verifies CLI tools are installed; creates Jenkins credentials + pipeline job via REST API | `devops/ansible/site.yml` |
| Jenkins | Runs the CI pipeline (native install, not containerized) | http://localhost:8080 |
| SonarQube | Static analysis quality gate | http://localhost:9000 |
| Trivy | Scans each built image for HIGH/CRITICAL CVEs | run from the Jenkins pipeline |
| Docker | Builds the 3 service images | `docker images \| grep wastios` |
| Nexus | OCI (Docker) registry that stores built images | http://localhost:8081 (UI), `localhost:8082` (registry) |
| Kubernetes (Minikube) | Runs the deployed app | `kubectl get pods -A` |
| Helm | Packages backend/frontend/ml_service as one chart | `devops/helm/wastios/` |
| Argo CD | GitOps continuous deployment — watches the repo, syncs the cluster | `kubectl -n argocd port-forward svc/argocd-server 8081:443` |
| Nginx | Ingress controller for the deployed app (`minikube addons enable ingress` — this *is* nginx under the hood) | `kubectl get ingress` |
| Prometheus | Scrapes backend `/metrics` + pod metrics via Kubernetes service discovery | port-forward `svc/prometheus -n monitoring 9090` |
| Grafana | Dashboards over Prometheus + Loki (both provisioned as datasources) | port-forward `svc/grafana -n monitoring 3000` |
| Loki + Promtail | Aggregates container logs from every pod in the cluster | Grafana → Explore → Loki |
| Alertmanager | Routes firing alerts (one rule: `BackendDown`) | port-forward `svc/alertmanager -n monitoring 9093` |

## A note on honesty: two pods are genuinely crash-looping

The backend and ml_service pods **crash-loop by design in this demo**, and I did not
paper over it — the point of the exercise is to show the pipeline and cluster working
correctly, not to fake a healthy app. Neither issue is a DevOps problem; both are real,
pre-existing constraints of the application itself:

- **backend**: it needs live Firebase (Firestore) + AWS S3 credentials to boot (it does
  a real Firestore query on startup). Rather than touch the app to bypass this, Terraform
  stands up a local Firestore emulator (`mtlynch/firestore-emulator`) and an S3-compatible
  mock (`adobe/s3mock`), and the Helm chart points the backend at them via env vars
  (`FIRESTORE_EMULATOR_HOST`, `AWS_ENDPOINT_URL_S3`) — no app code changed for this.
  It *still* crash-loops, because `backend/src/config/db.js` health-checks Firestore by
  querying a collection named `__healthcheck__`, and Firestore (real or emulated) rejects
  collection IDs that start and end with double underscores as reserved. This is a latent
  bug in the app's own health-check code, unrelated to DevOps — worth fixing in the app,
  not something this setup works around.
- **ml_service**: it loads a TorchScript model from `model.pt` on startup, but no trained
  model artifact is committed to the repo (`ml/checkpoints/` is gitignored by design —
  training produces a large binary). There is nothing to load until someone runs
  `ml/train.py` and supplies the resulting `.pt` file.

The frontend has no such dependency and runs cleanly.

This turned out to be a genuinely useful demo: the `BackendDown` Prometheus alert fires
for real and shows up as `active` in Alertmanager, and Argo CD correctly reports the
`wastios` Application as `Synced` (git and cluster state match) but `Degraded` (the pods
aren't healthy) — both tools doing exactly what they're supposed to do.

## First real pipeline run

Build #3 of `wastios-pipeline` ran the full chain for real: checkout → parallel
build (npm ci ×2, `python3 -m py_compile` for ml_service) → SonarQube analysis (passed,
against a live SonarQube instance) → three `docker build`s → three Trivy scans → push to
Nexus. Backend and frontend pushed cleanly; the ml_service image (~9GB, bundles PyTorch +
CUDA wheels) hit a one-off `net/http: timeout awaiting response headers` pushing to Nexus
— a genuine resource-contention issue (Jenkins, SonarQube, Nexus, and minikube all
competing for the same 8GB Docker Desktop VM), not a pipeline defect. A manual retry of
that single `docker push` succeeded in about a second once the earlier layers were
already uploaded. Everything after that (loading the built images into minikube, bumping
`devops/helm/wastios/values.yaml` to the new tag, and letting Argo CD sync it) completed
normally. If you hit the same timeout on a from-scratch run, either give Docker Desktop
more memory, or rely on the `retry(2)` now wrapped around each `docker push` in the
Jenkinsfile (added after this run, so future builds retry automatically).

**End-to-end confirmed working**: build 3's images (tag `3`) are live in Nexus, loaded
into minikube, and running as pods — `kubectl get pods -n default` shows
`wastios-frontend` on the new tag and `Synced` status on the Argo CD `wastios`
Application, entirely from a `git push` with no manual `kubectl apply`.

## How to test each component

All commands assume you're in the repo root unless noted.

### Terraform (SonarQube, Nexus, local emulators)
```bash
cd devops/terraform && terraform plan   # should show no changes if already applied
docker ps --filter name=wastios-        # sonarqube, nexus, firestore-emulator, s3mock
curl http://localhost:9000/api/system/status   # {"status":"UP"}
curl -I http://localhost:8081                  # Nexus UI, 200
```

### Ansible (CLI verification + Jenkins config)
```bash
cd devops/ansible
ansible-playbook -i inventory.ini site.yml \
  -e "jenkins_user=admin" -e "jenkins_token=<your Jenkins API token>" \
  -e "sonarqube_token=<a SonarQube user token>" \
  -e "nexus_user=admin" -e "nexus_password=<nexus admin password>" \
  -e "github_token=$(gh auth token)" \
  -e "job_config_path=/tmp/wastios-job-config.xml"
```
Re-running is idempotent: it checks for existing credentials/job before creating them.

### Jenkins pipeline
1. Open http://localhost:8080/job/wastios-pipeline
2. Click **Build Now**, or trigger via API:
   ```bash
   curl -u admin:<token> -X POST http://localhost:8080/job/wastios-pipeline/build
   ```
3. Watch the stage view. Stages: Checkout → Build (parallel: backend/frontend/ml_service)
   → SonarQube Analysis → Docker Build → Trivy Scan → Push to Nexus → Load into Minikube
   → Update Helm values (commits a new image tag, which is what triggers Argo CD).
4. To see SonarQube's quality gate actually matter, introduce an obvious code smell and
   watch the SonarQube project dashboard at http://localhost:9000/dashboard?id=wastios
   pick it up after the next build.
5. To see Trivy catch something, point a stage at an old base image tag (e.g.
   `node:18-slim` from a year-old digest) — the stage logs list every HIGH/CRITICAL CVE
   found (it doesn't fail the build in this minimal setup; change `--exit-code 0` to `1`
   in the Jenkinsfile if you want it to gate the pipeline).

### Nexus registry
```bash
docker images | grep localhost:8082      # images tagged for push
# Nexus UI → Browse → docker-hosted, after a pipeline run has pushed images
```

### Kubernetes / Helm / Argo CD (GitOps)
```bash
kubectl get pods -A
helm template devops/helm/wastios | less     # render the chart locally
kubectl -n argocd port-forward svc/argocd-server 8081:443
# open https://localhost:8081, log in as admin (password: initial admin secret, see below)
kubectl -n argocd get secret argocd-initial-admin-secret -o jsonpath='{.data.password}' | base64 -d
```
To see a real GitOps sync: edit `devops/helm/wastios/values.yaml` (e.g. bump a replica
count), commit, push — Argo CD picks it up within ~3 minutes (or force it: `kubectl -n
argocd patch application wastios --type merge -p '{"operation":{"sync":{}}}'`), and
`kubectl get pods` will show the change applied without anyone running `kubectl apply`.

### Ingress (Nginx)
```bash
kubectl get ingress
minikube ip                     # cluster IP
echo "$(minikube ip) wastios.local" | sudo tee -a /etc/hosts
curl http://wastios.local/                 # frontend
curl http://wastios.local/api/health       # backend (will fail while it's crash-looping)
```

### Prometheus / Grafana / Loki / Alertmanager
```bash
kubectl -n monitoring port-forward svc/prometheus 9090:9090 &
kubectl -n monitoring port-forward svc/grafana 3000:3000 &
kubectl -n monitoring port-forward svc/alertmanager 9093:9093 &
```
- Prometheus targets: http://localhost:9090/targets — `wastios-backend` shows `down`
  (expected, see above), `prometheus` itself shows `up`.
- Prometheus alerts: http://localhost:9090/alerts — `BackendDown` should be `firing`.
- Alertmanager: http://localhost:9093/#/alerts — the same alert shows as `active`.
- Grafana: http://localhost:3000 (anonymous admin access enabled for this demo) —
  Prometheus and Loki are already provisioned as datasources; use **Explore** to query
  either one directly, e.g. `up` in Prometheus or `{namespace="default"}` in Loki.

## Repo layout

```
devops/
  terraform/    Docker-provisioned SonarQube, Nexus, Firestore emulator, S3 mock
  ansible/      CLI verification + Jenkins credentials/job setup
  jenkins/      Jenkinsfile — the CI pipeline definition
  helm/wastios/ Helm chart for backend, frontend, ml_service + Ingress
  argocd/       Argo CD Application manifest (GitOps sync target)
  monitoring/   Prometheus, Alertmanager, Grafana, Loki, Promtail manifests
  docs/         this file
```

## Local environment notes

- Jenkins runs as its own `jenkins` system user; it was added to this machine's primary
  user group (and a few directories loosened to group-readable) so it can reach the
  Docker Desktop socket and the minikube kubeconfig. This is a local-machine-only
  arrangement for the demo, not a production pattern.
- `docker context` is set to `desktop-linux` so every container started here (Terraform,
  Jenkins builds, minikube's own node container) shows up in the Docker Desktop GUI.
- sonar-scanner's bundled JRE was disabled (`use_embedded_jre=false` in
  `/opt/sonar-scanner/bin/sonar-scanner`) because it shipped with JDK 17, and this
  SonarQube version requires JDK 21+; Jenkins now points it at the system's JDK 21 via
  `JAVA_HOME` in the Jenkinsfile.
