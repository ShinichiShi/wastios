#!/usr/bin/env bash
# Brings up the whole minimal DevOps stack for this repo: Docker Desktop,
# Terraform-provisioned support services (SonarQube/Nexus/emulators),
# minikube, Argo CD, and the monitoring stack. Idempotent — safe to re-run
# any time (e.g. after a reboot). Jenkins is a native systemd service and
# is only checked here, not installed.
#
# Usage: ./start-devops.sh

set -uo pipefail
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

step() { echo -e "\n==> $1"; }

step "Starting Docker Desktop"
systemctl --user start docker-desktop 2>/dev/null || true
for i in $(seq 1 30); do
  docker --context desktop-linux info >/dev/null 2>&1 && break
  sleep 2
done
docker context use desktop-linux >/dev/null
docker --context desktop-linux info >/dev/null 2>&1 \
  && echo "Docker Desktop is up." \
  || { echo "ERROR: Docker Desktop did not come up in time." >&2; exit 1; }

step "Checking Jenkins (native systemd service)"
if systemctl is-active --quiet jenkins; then
  echo "Jenkins is already running -> http://localhost:8080"
else
  echo "Jenkins is not running. Start it with: sudo systemctl start jenkins"
fi

step "Applying Terraform (SonarQube, Nexus, Firestore emulator, S3 mock)"
( cd "$ROOT_DIR/devops/terraform" && terraform init -input=false >/dev/null && terraform apply -auto-approve )

step "Waiting for SonarQube and Nexus to report healthy"
for i in $(seq 1 30); do
  sq=$(curl -s http://localhost:9000/api/system/status 2>/dev/null | grep -o '"status":"UP"' || true)
  nx=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:8081 2>/dev/null)
  [ -n "$sq" ] && [ "$nx" = "200" ] && break
  sleep 5
done
echo "SonarQube: http://localhost:9000   Nexus: http://localhost:8081"

step "Starting minikube"
minikube start --driver=docker --cpus=2 --memory=3500 >/dev/null
minikube addons enable ingress >/dev/null
echo "minikube is up ($(kubectl get nodes --no-headers | awk '{print $2}'))"

step "Installing/checking Argo CD"
if ! kubectl get namespace argocd >/dev/null 2>&1; then
  kubectl create namespace argocd
  kubectl apply -n argocd --server-side=true --force-conflicts \
    -f https://raw.githubusercontent.com/argoproj/argo-cd/stable/manifests/install.yaml >/dev/null
fi
kubectl wait --for=condition=Available deployment --all -n argocd --timeout=180s >/dev/null 2>&1 || true
kubectl apply -f "$ROOT_DIR/devops/argocd/application.yaml" >/dev/null
echo "Argo CD Application status:"
kubectl get application wastios -n argocd 2>/dev/null || true

step "Applying monitoring stack (Prometheus, Grafana, Loki, Promtail, Alertmanager)"
kubectl apply -f "$ROOT_DIR/devops/monitoring/" >/dev/null

step "Current cluster pods"
kubectl get pods -A

cat <<EOF

==================== Access points ====================
Jenkins        http://localhost:8080
SonarQube      http://localhost:9000
Nexus          http://localhost:8081  (registry: localhost:8082)
Firestore mock http://localhost:8090
S3 mock        http://localhost:9090

Argo CD, Prometheus, Grafana, and Alertmanager aren't exposed on the host by
default; port-forward whichever you need:
  kubectl -n argocd      port-forward svc/argocd-server 8443:443
  kubectl -n monitoring  port-forward svc/prometheus     9091:9090
  kubectl -n monitoring  port-forward svc/grafana         3000:3000
  kubectl -n monitoring  port-forward svc/alertmanager    9093:9093

App ingress (once /etc/hosts has "\$(minikube ip) wastios.local"):
  http://wastios.local
=========================================================
EOF
