"""Fase 4 §34-35: path traversal deve falhar sempre (sem Docker)."""

import os

import pytest
from app.modules.hosting import paths
from app.modules.hosting.paths import PathError


@pytest.mark.parametrize("evil", [
    "../../etc/passwd",
    "/etc/passwd",
    "/root",
    "/var/run/docker.sock",
    "../other-client",
    "..\\windows\\system32",
    "%2e%2e/%2e%2e/etc/passwd",
    "%252e%252e/%252e%252e/x",
    "..%2f..%2fetc/passwd",
    "a/../../b",
    "\x00/etc/passwd",
    "~/root",
    "....//....//etc/passwd",
])
def test_traversal_blocked(evil):
    with pytest.raises(PathError):
        paths.validate(evil)


@pytest.mark.parametrize("ok", ["index.html", "css/app.css", "a/b/c.txt", "./x.md"])
def test_valid_paths(ok):
    out = paths.validate(ok)
    assert ".." not in out and not out.startswith("/")


@pytest.mark.parametrize("blocked", [
    ".env", ".env.production", "Dockerfile", "docker-compose.yml",
    "app.pem", "key.key", "id_rsa", "config.secret.json", ".git/config",
    "app.exe", "run.sh", "photo.png",
])
def test_blocklist_and_edit_ext(blocked):
    with pytest.raises(PathError):
        paths.validate(blocked, for_edit=True)


@pytest.mark.parametrize("editable", [
    "index.html", "style.css", "app.js", "data.json", "post.php",
    "README.md", "notes.txt", "config.yml", "feed.xml",
])
def test_editable_ok(editable):
    assert paths.validate(editable, for_edit=True) == editable


def test_symlink_escape_blocked(tmp_path):
    outside = tmp_path / "outside"
    outside.mkdir()
    (outside / "secret.txt").write_text("x")
    root = tmp_path / "root"
    root.mkdir()
    os.symlink(str(outside), str(root / "link"))
    with pytest.raises(PathError):
        paths.contain(str(root), "link/secret.txt")
    # caminho legítimo passa
    (root / "ok").mkdir()
    assert paths.contain(str(root), "ok").endswith("ok")


def test_host_write_read_roundtrip(tmp_path):
    from app.modules.hosting.provider import DockerHostingProvider

    root = str(tmp_path / "r")
    os.makedirs(root)
    DockerHostingProvider.host_write(root, "a/b.txt", b"hello")
    assert DockerHostingProvider.host_read(root, "a/b.txt") == b"hello"
    with pytest.raises(PathError):
        DockerHostingProvider.host_write(root, ".env", b"x")


def test_container_symlink_escape_blocked():
    """Symlink dentro do container apontando p/ fora do root (Fase 4 revisão)."""
    from app.modules.hosting.provider import DockerHostingProvider

    # /root-do-cliente/public/link -> /etc ; Portal pede public/link/passwd
    assert DockerHostingProvider._cjoin("/srv", "public/link/passwd") == \
        "/srv/public/link/passwd"  # lexical ok aqui...
    # ...mas o escape real acontece no readlink -f pós-escrita/leitura.
    # Simulação fiel com root real:
    import os
    import tempfile

    with tempfile.TemporaryDirectory() as tmp:
        root = os.path.join(tmp, "root")
        os.makedirs(os.path.join(root, "public"))
        os.symlink("/etc", os.path.join(root, "public", "link"))
        from app.modules.hosting import paths

        with pytest.raises(PathError):
            paths.contain(os.path.realpath(root), "public/link/passwd")


def test_container_symlink_resolve_blocks_escape(monkeypatch):
    """readlink -f apontando p/ fora do base deve bloquear (mock, sem Docker)."""
    from app.modules.hosting import provider as prov_mod
    from app.modules.hosting.provider import DockerHostingProvider, HostingError

    def fake_docker(*args, **kwargs):
        cmd = list(args)
        if cmd[:2] == ["exec", "c"] and "readlink" in cmd:
            target = cmd[-1]
            if "link/passwd" in target:
                return "/etc/passwd\n"
            if target.endswith("/public"):
                return "/srv/public\n"
            return target + "\n"
        raise AssertionError(f"comando inesperado: {cmd}")

    monkeypatch.setattr(prov_mod, "_docker", fake_docker)
    p = DockerHostingProvider()
    import pytest

    with pytest.raises(HostingError):
        p._resolve_container("c", "/srv", "public/link/passwd")
    assert p._resolve_container("c", "/srv", "public") == "/srv/public"
