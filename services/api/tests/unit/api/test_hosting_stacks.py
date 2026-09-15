"""TAREFA 1: agrupamento por stack, roles, filtro de infra (puro, sem docker)."""

from app.modules.hosting.service import HostingServiceLayer as L


def _row(name, image="img", status="running", project=None, service=None):
    labels = (
        f"com.docker.compose.project={project}," f"com.docker.compose.service={service}"
        if project
        else ""
    )
    return {
        "name": name,
        "image": image,
        "status": status,
        "ports": "",
        "project": project,
        "workdir": None,
        "service": service,
        "_labels_raw": labels,
    }


def test_group_by_compose_project():
    rows = [
        _row("heavy-clean-web", service="web", project="heavy-clean"),
        _row("heavy-clean-api", service="api", project="heavy-clean"),
        _row(
            "heavy-clean-pg", image="postgres:16", service="db", project="heavy-clean"
        ),
    ]
    groups = L.group_stacks(rows)
    assert len(groups) == 1
    g = groups[0]
    assert g["compose_project"] == "heavy-clean"
    assert g["containers_total"] == 3
    assert g["health"] == "healthy"
    assert g["stack_type"] == "customer_service"
    roles = {c["role"] for c in g["containers"]}
    assert {"web", "api", "database"} <= roles


def test_no_prefix_grouping_for_standalone():
    rows = [
        _row("clinica-toufic-web", service="web"),
        _row("core-pilates-app", service="app"),
    ]
    groups = L.group_stacks(rows)
    assert len(groups) == 2
    assert all(g["compose_project"] is None for g in groups)
    assert {g["key"] for g in groups} == {
        "standalone:clinica-toufic-web",
        "standalone:core-pilates-app",
    }


def test_platform_infra_by_project():
    rows = [
        _row(
            "fixelo-traefik", image="traefik:v3", service="traefik", project="traefik"
        ),
        _row(
            "observability-prometheus",
            image="prom/prometheus",
            service="prometheus",
            project="observability",
        ),
        _row(
            "innexar-mailserver",
            image="mailserver",
            service="mailserver",
            project="innexar-mail",
        ),
    ]
    for g in L.group_stacks(rows):
        assert g["stack_type"] == "platform_infra", g


def test_platform_infra_standalone_container():
    rows = [_row("portainer", image="portainer-ce")]
    groups = L.group_stacks(rows)
    assert len(groups) == 1
    assert groups[0]["stack_type"] == "platform_infra"


def test_customer_project_with_same_prefix_as_infra_stays_customer():
    # prefixo parecido com infra NÃO contamina: só label exata classifica.
    rows = [
        _row("mail-relay-cliente", image="relay", service="relay", project="cliente-x")
    ]
    groups = L.group_stacks(rows)
    assert groups[0]["stack_type"] == "customer_service"


def test_infer_role_matrix():
    assert L.infer_role("db", "postgres:16-alpine") == "database"
    assert L.infer_role("redis", "redis:7-alpine") == "cache"
    assert L.infer_role("minio", "minio/minio:latest") == "storage"
    assert L.infer_role("api", "heavy-clean-api") == "api"
    assert L.infer_role("web", "heavy-clean-web") == "web"
    assert L.infer_role("session-scheduler", "x-scheduler") == "worker"
    assert L.infer_role("evolution", "evoapicloud/evolution-api:v2") == "worker"
    assert L.infer_role("traefik", "traefik:v3") == "proxy"
    assert L.infer_role("x", "x") == "other"


def test_label_value_survives_traefik_commas():
    raw = (
        "traefik.http.routers.x.rule=Host(`a.com`) || Host(`b.com`),"
        "com.docker.compose.project=heavy-clean,"
        "com.docker.compose.service=web"
    )
    assert L._label_value(raw, "com.docker.compose.project") == "heavy-clean"
    assert L._label_value(raw, "com.docker.compose.service") == "web"
    assert L._label_value(raw, "inexistente") is None


def test_health_degraded_and_stopped():
    rows = [
        _row("a-web", service="web", project="p"),
        _row("a-db", image="postgres:16", service="db", project="p", status="exited"),
    ]
    g = L.group_stacks(rows)[0]
    assert g["health"] == "degraded"
    rows2 = [_row("b-web", service="web", project="q", status="exited")]
    assert L.group_stacks(rows2)[0]["health"] == "stopped"


def test_public_domain_upgrades_unknown_role_to_web():
    rows = [_row("dhv-log-consultoria-web", image="dhv-log-consultoria:latest")]
    rows[0]["_labels_raw"] = "traefik.http.routers.x.rule=Host(`dhv.innexar.com.br`)"
    g = L.group_stacks(rows)[0]
    assert g["domains"] == ["dhv.innexar.com.br"]
    assert g["containers"][0]["role"] == "web"


def test_workspace_postgres_is_platform_infra():
    rows = [
        _row(
            "innexar-usa-workspace-postgres",
            image="postgres:15",
            service="postgres",
            project="innexar-usa-workspace",
        )
    ]
    g = L.group_stacks(rows)[0]
    assert g["stack_type"] == "platform_infra"
