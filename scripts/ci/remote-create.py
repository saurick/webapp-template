#!/usr/bin/env python3
"""SSH 接收端：授权、主机准备、精确源码安装与已有创建入口的组合。"""

import hashlib
import importlib.util
import json
import os
from pathlib import Path
import platform
import subprocess
import sys
import tempfile

sys.dont_write_bytecode = True
SOURCES = Path('/opt/webapp-template-sources')
PROJECTS = Path('/srv/webapp-template-projects')


def load(name, file):
    spec = importlib.util.spec_from_file_location(name, file)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def install_source(bundle, sha, runner):
    runner.ensure_directory(SOURCES)
    target, marker = SOURCES / sha, SOURCES / (sha + '.json')
    def git(args, cwd):
        result = subprocess.run(['git', *args], cwd=cwd, env={**os.environ, 'GIT_OPTIONAL_LOCKS': '0'},
                                capture_output=True, text=True, timeout=120)
        runner.require(result.returncode == 0, '模板 bundle 安装失败；保留已存在源码，不覆盖')
        return result.stdout.strip()
    if target.exists():
        runner.require(not target.is_symlink() and marker.exists()
                       and json.loads(runner.private_read(marker)) == {'template_sha': sha}, '模板源码目录归属不符')
    else:
        runner.require(not marker.exists(), '模板源码状态不完整，保留现场')
        with tempfile.TemporaryDirectory(prefix='source-', dir=SOURCES) as temporary:
            checkout = Path(temporary) / 'checkout'
            git(['clone', '--quiet', '--no-checkout', str(bundle), str(checkout)], SOURCES)
            git(['checkout', '--quiet', '--detach', sha], checkout)
            git(['remote', 'remove', 'origin'], checkout)
            checkout.rename(target)
        runner.atomic_write(marker, json.dumps({'template_sha': sha}))
    runner.require(git(['rev-parse', 'HEAD'], target) == sha
                   and not git(['status', '--porcelain=v1', '--untracked-files=all'], target), '已安装模板源码有变化，拒绝覆盖')
    return target


def execute(stage, runner):
    require = runner.require
    require(os.geteuid() == 0 and platform.system() == 'Linux' and platform.machine() == 'x86_64', '需要 Linux/amd64 root 构建机')
    data = json.loads(runner.private_read(stage / 'request.json'))
    import re
    require(re.fullmatch(r'[a-f0-9]{40}', data['template_sha']) and 60 <= data['timeout'] <= 7200, '无效请求版本或等待上限')
    require(re.fullmatch(r'[A-Za-z0-9_.-]+(?:/[A-Za-z0-9_.-]+)+', data['project']), '项目路径必须为 namespace/project')
    config = runner.validate_config({**data['config'], 'api_token_file': str(stage / 'api-token')})
    auth = load('namespace_check', stage / 'scripts/ci/check-namespace.py').check(runner.API(config), data['project'], require)
    print(json.dumps({'phase': 'namespace-authorized', **auth}), flush=True)
    host = load('host_preparation', stage / 'scripts/ci/prepare-host.py').prepare(config, stage, runner)
    os.environ['PATH'] = host.pop('path')
    print(json.dumps({'phase': 'host-ready', **host}), flush=True)
    source = install_source(stage / 'template.bundle', data['template_sha'], runner)
    require((source / '.n-node-version').read_text() == (stage / '.n-node-version').read_text(), '源码工具合同不符')
    runner.ensure_directory(PROJECTS)
    namespace, project = data['project'].rsplit('/', 1)
    prefix = hashlib.sha256((config['gitlab_url'] + '/' + namespace).encode()).hexdigest()[:12]
    destination = PROJECTS / (prefix + '-' + project)
    runner.atomic_write(stage / 'host.json', json.dumps(config))
    creator = load('project_creator', source / 'scripts/create-project.py')
    try:
        result = creator.create(config, data['project'], data['name'], destination, data['timeout'])
    except creator.runner.SetupError as exc:
        raise runner.SetupError(str(exc)) from None
    return {'schema': 1, 'result': result, 'namespace': auth, 'host_preparation': host,
            'remote_source': str(source), 'temporary_credentials_removed': True}


def main(stage):
    runner = load('remote_runner_setup', stage / 'scripts/ci/setup-runner.py')
    try:
        return execute(stage, runner), 0
    except (runner.SetupError, OSError, ValueError, KeyError, TypeError, subprocess.SubprocessError) as exc:
        print('[remote:create] ' + (str(exc) if isinstance(exc, runner.SetupError) else type(exc).__name__), file=sys.stderr)
        return None, 1
