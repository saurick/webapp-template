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
import time

TOOLS = Path('/opt/webapp-template-host-tools')
STATE = Path('/var/lib/webapp-template-host')


def transient_download(code, diagnostic):
    if re.search(r'certificate|authentication|login denied|(?:response|error:)\s+(?:401|403|404|407)\b', diagnostic, re.I):
        return False
    if code in (5, 6, 7, 18, 28, 52, 55, 56):
        return True
    if code == 35:
        return bool(re.search(r'SSL_ERROR_SYSCALL|unexpected eof|connection reset', diagnostic, re.I))
    return code == 22 and bool(re.search(r'error:\s*(?:408|429|500|502|503|504)\b', diagnostic, re.I))


def transient_apt_update(output):
    """仅重试可配对的网关错误；APT 的后续未签名摘要不代表绕过签名校验。"""
    errors = [line for line in output.splitlines() if line.startswith('E:')]
    fetches = set()
    remaining = []
    if any(re.search(r'NO_PUBKEY|EXPKEYSIG|BADSIG|GPG error|Hash Sum mismatch|signature', line, re.I)
           for line in output.splitlines()):
        return False
    for line in errors:
        match = re.fullmatch(r'E: Failed to fetch (https?://\S+)\s+(.+)', line)
        if match:
            if not re.search(r'\b(?:502\s+Bad\s+Gateway|503\s+Service\s+Unavailable|504\s+Gateway\s+Time-?out)\b', match[2], re.I):
                return False
            fetches.add(match[1])
        else:
            remaining.append(line)
    if not fetches:
        return False
    for line in remaining:
        if line == 'E: Some index files failed to download. They have been ignored, or old ones used instead.':
            continue
        match = re.fullmatch(r"E: The repository '(https?://\S+) (\S+) (InRelease|Release)' is not signed\.", line)
        if not match or match[1].rstrip('/') + '/dists/' + match[2] + '/' + match[3] not in fetches:
            return False
    return True


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
    env = {**os.environ, **config['environment'], 'DEBIAN_FRONTEND': 'noninteractive', 'NEEDRESTART_MODE': 'l', 'LC_ALL': 'C'}
    actions = []
    log = STATE / 'prepare.log'
    if log.exists():
        runner.private_read(log)
    else:
        runner.atomic_write(log, '')

    def execute(args, timeout=600):
        result = subprocess.run(args, env=env, capture_output=True, text=True, timeout=timeout)
        with log.open('a') as stream:
            stream.write((result.stdout or '') + (result.stderr or ''))
        return result

    def run(args, timeout=600):
        result = execute(args, timeout)
        require(result.returncode == 0, f'主机准备命令失败：{Path(args[0]).name}；日志 {log}')
        return result.stdout.strip()

    def download(url, target):
        for attempt in range(3):
            result = execute(['curl', '--http1.1', '-fsSL', '--connect-timeout', '20', '--max-time', '180', url, '-o', str(target)], timeout=210)
            with log.open('a') as stream:
                stream.write(f'\n[host:download] attempt={attempt + 1}/3 exit={result.returncode}\n')
            if result.returncode == 0:
                return
            require(attempt < 2 and transient_download(result.returncode, result.stderr or ''),
                    f'主机准备命令失败：curl；日志 {log}')
            print(f'[remote:host] 工具下载网络瞬断，等待后重试 {attempt + 2}/3', flush=True)
            time.sleep((3, 10)[attempt])

    missing = [package for executable, package in [('git', 'git'), ('curl', 'curl'), ('bash', 'bash'),
               ('xz', 'xz-utils'), ('apparmor_parser', 'apparmor')] if not shutil.which(executable)]
    if not Path('/etc/ssl/certs/ca-certificates.crt').is_file():
        missing.append('ca-certificates')
    # 构建机安装只需要签名与软件包索引，不下载命令查询和桌面应用元数据。
    apt = ['apt-get', '-o', 'Acquire::Retries=3', '-o', 'Acquire::http::Timeout=30',
           '-o', 'Acquire::https::Timeout=30', '-o', 'APT::Update::Error-Mode=any',
           '-o', 'Acquire::Languages=none', '-o', 'Acquire::IndexTargets::deb::CNF::DefaultEnabled=false',
           '-o', 'Acquire::IndexTargets::deb::DEP-11::DefaultEnabled=false']
    def apt_update():
        for attempt in range(3):
            result = execute([*apt, 'update'])
            with log.open('a') as stream:
                stream.write(f'\n[host:apt-update] attempt={attempt + 1}/3 exit={result.returncode}\n')
            if result.returncode == 0:
                return
            require(attempt < 2 and result.returncode == 100
                    and transient_apt_update((result.stdout or '') + '\n' + (result.stderr or '')),
                    f'主机准备命令失败：apt-get；日志 {log}')
            print(f'[remote:host] APT 网关瞬断，等待后重试 {attempt + 2}/3', flush=True)
            time.sleep((3, 10)[attempt])
    if missing:
        apt_update()
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
        network = {k: v for k, v in config['environment'].items()
                   if k in ('HTTP_PROXY', 'HTTPS_PROXY', 'http_proxy', 'https_proxy', 'NO_PROXY', 'no_proxy')}
        if any(network.get(k) for k in ('HTTP_PROXY', 'HTTPS_PROXY', 'http_proxy', 'https_proxy')):
            dropin = Path('/etc/systemd/system/docker.service.d/webapp-template-network.conf')
            env_file = STATE / 'docker.env'
            unit = ('# Managed by scripts/ci/prepare-host.py: new Docker service\n'
                    f'[Service]\nEnvironmentFile={env_file}\n')
            values = ''.join(k + '=' + json.dumps(v) + '\n' for k, v in sorted(network.items()))
            require(not dropin.parent.is_symlink(), 'Docker systemd 目录不能为符号链接')
            others = list(dropin.parent.glob('*.conf')) if dropin.parent.exists() else []
            require(not any(p != dropin for p in others), '已有 Docker service 配置，拒绝接管')
            if dropin.exists():
                require(not dropin.is_symlink() and dropin.stat().st_uid == os.geteuid()
                        and not dropin.stat().st_mode & 0o022 and dropin.read_text() == unit
                        and runner.private_read(env_file) == values, '新 Docker 网络配置归属或内容不符')
            else:
                require(not env_file.exists(), 'Docker 网络配置状态不完整，保留现场')
                dropin.parent.mkdir(mode=0o755, parents=True, exist_ok=True)
                runner.atomic_write(env_file, values)
                runner.atomic_write(dropin, unit, 0o644)
            # 在 apt 首次启动 daemon 前提供网络配置，不重启已存在的 Docker。
            run(['systemctl', 'daemon-reload'])
            actions.append('configure private proxy environment for new Docker service')
        apt_update()
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
        require(not managed_binary.is_symlink() and managed_binary.stat().st_uid == os.geteuid()
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
