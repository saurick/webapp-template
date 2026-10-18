#!/usr/bin/env python3
"""补齐隔离 Ubuntu 构建机工具，复用健康服务，不升级或重启已有服务。"""

import fcntl
import hashlib
import json
import os
from pathlib import Path
import re
import shutil
import subprocess
import tarfile
import tempfile

TOOLS = Path('/opt/webapp-template-host-tools')
STATE = Path('/var/lib/webapp-template-host')


def prepare(config, root, runner):
    require = runner.require
    runner.ensure_directory(STATE)
    runner.ensure_directory(TOOLS)
    lock_path = STATE / 'lock'
    require(not lock_path.is_symlink(), '主机准备锁不能为符号链接')
    with open(lock_path, 'a', opener=lambda p, flags: os.open(p, flags, 0o600)) as lock:
        try:
            fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        except BlockingIOError:
            raise runner.SetupError('构建机正在准备工具，请稍后重跑') from None
        return prepare_locked(config, root, runner)


def prepare_locked(config, root, runner):
    require = runner.require
    env = {**os.environ, **config['environment'], 'DEBIAN_FRONTEND': 'noninteractive', 'NEEDRESTART_MODE': 'l'}
    actions = []
    log = STATE / 'prepare.log'
    if log.exists():
        runner.private_read(log)
    else:
        runner.atomic_write(log, '')

    def run(args, timeout=600):
        result = subprocess.run(args, env=env, capture_output=True, text=True, timeout=timeout)
        with log.open('a') as stream:
            stream.write((result.stdout or '') + (result.stderr or ''))
        require(result.returncode == 0, f'主机准备命令失败：{Path(args[0]).name}；日志 {log}')
        return result.stdout.strip()

    def download(url, target):
        run(['curl', '--http1.1', '-fsSL', '--retry', '2', '--retry-max-time', '180', '--max-time', '180', url, '-o', str(target)])

    missing = [package for executable, package in [('git', 'git'), ('curl', 'curl'), ('bash', 'bash'),
               ('xz', 'xz-utils'), ('apparmor_parser', 'apparmor')] if not shutil.which(executable)]
    if not Path('/etc/ssl/certs/ca-certificates.crt').is_file():
        missing.append('ca-certificates')
    apt = ['apt-get', '-o', 'Acquire::Retries=3', '-o', 'Acquire::https::Timeout=30']
    if missing:
        run([*apt, 'update'])
        run([*apt, 'install', '--yes', '--no-install-recommends', *missing])
        actions.append('install missing Ubuntu base packages')
    contract = json.loads((root / 'server/deploy/ci-runner/host-tools.json').read_text())
    if not shutil.which('docker'):
        require(not Path('/etc/docker/daemon.json').exists() and not Path('/var/lib/docker').exists(),
                '发现已有 Docker 数据或配置但缺少 binary，拒绝接管')
        source = Path('/etc/apt/sources.list.d/webapp-template-docker.sources')
        others = [p for pattern in ('*.list', '*.sources') for p in source.parent.glob(pattern)
                  if p != source and 'download.docker.com' in p.read_text()]
        require(not others, '已有其他 Docker apt source，拒绝创建冲突配置')
        conflicts = subprocess.run(['dpkg-query', '-W', '-f=${db:Status-Status}\n', 'docker.io', 'podman-docker', 'containerd', 'runc'],
                                   capture_output=True, text=True)
        require('installed' not in conflicts.stdout.splitlines(), '已有 Docker / containerd 冲突包，保留现场')
        release = dict(line.split('=', 1) for line in Path('/etc/os-release').read_text().splitlines() if '=' in line)
        codename = release['VERSION_CODENAME'].strip('"')
        require(codename in ('noble', 'resolute'), '不支持的 Ubuntu Docker 仓库')
        key = Path('/etc/apt/keyrings/webapp-template-docker.asc')
        key.parent.mkdir(mode=0o755, exist_ok=True)
        with tempfile.TemporaryDirectory(dir=STATE) as temporary:
            fetched = Path(temporary) / 'docker.asc'
            download('https://download.docker.com/linux/ubuntu/gpg', fetched)
            require(not key.exists() or (not key.is_symlink() and key.read_bytes() == fetched.read_bytes()), 'Docker 仓库 key 归属不符')
            runner.atomic_write(key, fetched.read_text(), 0o644)
        content = ('# Managed by scripts/ci/prepare-host.py\nTypes: deb\nURIs: https://download.docker.com/linux/ubuntu\n'
                   f'Suites: {codename}\nComponents: stable\nArchitectures: amd64\nSigned-By: {key}\n')
        require(not source.exists() or (not source.is_symlink() and source.read_text() == content), 'Docker apt source 归属不符')
        runner.atomic_write(source, content, 0o644)
        run([*apt, 'update'])
        run([*apt, 'install', '--yes', '--no-install-recommends', 'docker-ce', 'docker-ce-cli', 'containerd.io',
             'docker-buildx-plugin', 'docker-compose-plugin'])
        run(['systemctl', 'enable', '--now', 'docker'])
        actions.append('install Docker from official signed Ubuntu repository')
    docker_version = run(['docker', 'version', '--format', '{{.Server.Version}}'])
    def version(value):
        found = re.match(r'(\d+)\.(\d+)\.(\d+)', value)
        require(found, '工具版本格式无效')
        return tuple(map(int, found.groups()))
    require(version(docker_version) >= version(contract['docker_minimum']), '已有 Docker 版本过旧；不自动升级共享服务')
    require(run(['docker', 'info', '--format', '{{.OSType}}/{{.Architecture}}']) in ('linux/x86_64', 'linux/amd64'), 'Docker daemon 平台不符')
    managed_binary = TOOLS / 'bin/gitlab-runner'
    binary = shutil.which('gitlab-runner')
    if not binary and managed_binary.exists():
        require(not managed_binary.is_symlink() and managed_binary.stat().st_uid == 0
                and hashlib.sha256(managed_binary.read_bytes()).hexdigest() == contract['runner_linux_amd64_sha256'],
                '已安装 Runner binary 的归属或校验值不符')
        binary = str(managed_binary)
    if not binary:
        runner.ensure_directory(TOOLS / 'bin')
        binary = str(managed_binary)
        require(not Path(binary).exists(), 'Runner binary 路径已有其他文件')
        with tempfile.TemporaryDirectory(dir=STATE) as temporary:
            fetched = Path(temporary) / 'gitlab-runner'
            download(f"https://gitlab-runner-downloads.s3.amazonaws.com/v{contract['runner_version']}/binaries/gitlab-runner-linux-amd64", fetched)
            require(hashlib.sha256(fetched.read_bytes()).hexdigest() == contract['runner_linux_amd64_sha256'], 'Runner 下载校验失败')
            fetched.chmod(0o755)
            fetched.rename(binary)
        actions.append('install checksum-pinned GitLab Runner binary')
    runner_version = re.search(r'Version:\s+(\d+\.\d+\.\d+)', run([binary, '--version']))
    require(runner_version and version(runner_version[1]) >= version(contract['runner_version']), '已有 Runner 版本过旧；不自动升级')
    node_version = (root / '.n-node-version').read_text().strip()
    require(re.fullmatch(r'\d+\.\d+\.\d+', node_version), 'Node 版本合同无效')
    prefix = TOOLS / ('node-v' + node_version)
    marker = prefix / '.template-tool.json'
    if not prefix.exists():
        with tempfile.TemporaryDirectory(dir=STATE) as temporary:
            work = Path(temporary)
            filename = f'node-v{node_version}-linux-x64.tar.xz'
            download(f'https://nodejs.org/dist/v{node_version}/SHASUMS256.txt', work / 'checksums')
            matches = [line.split()[0] for line in (work / 'checksums').read_text().splitlines() if line.split()[-1] == filename]
            require(len(matches) == 1 and re.fullmatch(r'[a-f0-9]{64}', matches[0]), 'Node 官方校验文件不符')
            download(f'https://nodejs.org/dist/v{node_version}/{filename}', work / filename)
            require(hashlib.sha256((work / filename).read_bytes()).hexdigest() == matches[0], 'Node 下载校验失败')
            with tarfile.open(work / filename) as archive:
                archive.extractall(work, filter='data')
            extracted = work / f'node-v{node_version}-linux-x64'
            runner.atomic_write(extracted / '.template-tool.json', json.dumps({'node_version': node_version, 'archive_sha256': matches[0]}))
            extracted.rename(prefix)
        actions.append('install official checksum-verified isolated Node')
    require(not prefix.is_symlink() and marker.is_file() and json.loads(runner.private_read(marker))['node_version'] == node_version,
            'Node 安装目录归属不符')
    require(run([str(prefix / 'bin/node'), '--version']) == 'v' + node_version, '隔离 Node 版本不符')
    path = str(prefix / 'bin') + ':' + str(Path(binary).parent) + ':' + os.environ['PATH']
    return {'node': node_version, 'runner': runner_version[1], 'docker': docker_version, 'actions': actions,
            'existing_services_restarted': False, 'path': path}
