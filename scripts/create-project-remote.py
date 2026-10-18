#!/usr/bin/env python3
"""从 Mac 通过已信任的 SSH 构建机创建项目并验收首轮 CI。"""

import argparse
import hashlib
import importlib.util
import json
import os
from pathlib import Path
import re
import shlex
import subprocess
import sys
import tarfile
import tempfile

sys.dont_write_bytecode = True
ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('runner_setup_remote_client', ROOT / 'scripts/ci/setup-runner.py')
runner = importlib.util.module_from_spec(spec)
spec.loader.exec_module(runner)
PAYLOAD = ('scripts/ci/setup-runner.py', 'scripts/ci/check-namespace.py', 'scripts/ci/prepare-host.py',
           'scripts/ci/remote-create.py', 'server/deploy/ci-runner/host-tools.json', '.n-node-version')
PREFIX = 'REMOTE_CREATE_RESULT '
RECEIVER = r'''
import json,os,runpy,shutil,signal,sys,tarfile,tempfile
from pathlib import Path
base=Path('/var/lib/webapp-template-remote')
base.mkdir(mode=0o700,exist_ok=True)
assert not base.is_symlink() and base.stat().st_uid==0 and base.stat().st_mode&0o777==0o700
stage=Path(tempfile.mkdtemp(prefix='request-',dir=base))
allowed=ALLOWED
seen=set();total=0
result=None;code=1
def interrupt(*args):raise KeyboardInterrupt()
signal.signal(signal.SIGTERM,interrupt);signal.signal(signal.SIGHUP,interrupt)
try:
 with tarfile.open(fileobj=sys.stdin.buffer,mode='r|') as archive:
  for member in archive:
   assert member.name in allowed and member.name not in seen and member.isfile() and member.size<=128*1024*1024
   seen.add(member.name);total+=member.size;assert total<=256*1024*1024
   path=stage/member.name;path.parent.mkdir(mode=0o700,parents=True,exist_ok=True)
   with open(path,'xb',opener=lambda p,f:os.open(p,f,0o600)) as output:
    with archive.extractfile(member) as content:shutil.copyfileobj(content,output)
 assert seen==allowed
 result,code=runpy.run_path(str(stage/'scripts/ci/remote-create.py'))['main'](stage)
except KeyboardInterrupt:
 print('[remote:create] 已中断；同命令可回读远端 CI 状态',file=sys.stderr);code=130
except Exception as exc:
 print('[remote:create] 接收失败：'+type(exc).__name__,file=sys.stderr);code=1
finally:
 shutil.rmtree(stage)
if code==0:print('REMOTE_CREATE_RESULT '+json.dumps(result,ensure_ascii=False),flush=True)
sys.exit(code)
'''.replace('ALLOWED', repr(set(PAYLOAD) | {'template.bundle', 'request.json', 'api-token'}))


def load_config(path):
    path = Path(path).expanduser()
    runner.require(not path.resolve().is_relative_to(ROOT), 'Mac 私有配置须位于模板仓库之外')
    config = json.loads(runner.private_read(path))
    host = config.pop('ssh_host')
    runner.require(isinstance(host, str) and re.fullmatch(r'(?:[A-Za-z0-9_.-]+@)?[A-Za-z0-9][A-Za-z0-9_.-]*', host),
                   'ssh_host 必须为既有 SSH alias 或 user@host，不接受命令或 SSH options')
    config = runner.validate_config(config)
    token_path = Path(config.pop('api_token_file')).expanduser()
    runner.require(not token_path.resolve().is_relative_to(ROOT), 'API token 文件须位于模板仓库之外')
    token = runner.private_read(token_path).strip()
    runner.require(token and not any(c.isspace() for c in token), 'token 文件为空或格式无效')
    return host, config, token


def git(args, strip=True):
    env = os.environ.copy()
    for key in list(env):
        if key.startswith('GIT_'):
            env.pop(key)
    result = subprocess.run(['git', *args], cwd=ROOT, env={**env, 'GIT_OPTIONAL_LOCKS': '0'},
                            capture_output=True, text=True, timeout=120)
    runner.require(result.returncode == 0, '本地模板 Git 命令失败')
    return result.stdout.strip() if strip else result.stdout


def ssh(host):
    return ['ssh', '-o', 'StrictHostKeyChecking=yes', '-o', 'BatchMode=yes', '-o', 'ConnectTimeout=10',
            '-o', 'ServerAliveInterval=15', '-o', 'ServerAliveCountMax=3', host]


def create(config_path, project, name, timeout, receipt):
    runner.require(re.fullmatch(r'[A-Za-z0-9_.-]+(?:/[A-Za-z0-9_.-]+)+', project), '项目路径必须为 namespace/project')
    runner.require(re.fullmatch(r'[a-z][a-z0-9]*(?:-[a-z0-9]+)*', project.rsplit('/', 1)[-1])
                   and len(project.rsplit('/', 1)[-1]) <= 48 and project.rsplit('/', 1)[-1] != 'webapp-template', '项目标识格式无效')
    runner.require(isinstance(name, str) and 1 <= len(name.strip()) <= 40 and not re.search(r'[\x00-\x1f\x7f<>`$]', name), '项目名称格式无效')
    runner.require(60 <= timeout <= 7200, '等待 CI 上限须为 60..7200 秒')
    host, config, token = load_config(config_path)
    sha = git(['rev-parse', 'HEAD'])
    runner.require(not git(['status', '--porcelain=v1', '--untracked-files=all']), '模板工作区或 index 有修改，请先收口')
    runner.require(re.search(r'^DEV_PROJECT_ID=webapp-template$', (ROOT / 'config/dev-ports.env').read_text(), re.M), '须从模板源仓库执行')
    # 主机信任、SSH key 与 sudo 是调用者既有授权，不自动接受 host key 或索取密码。
    bootstrap = ''.join('export ' + k + '=' + shlex.quote(v) + '\n' for k, v in sorted(config['environment'].items()))
    bootstrap += (ROOT / 'scripts/ci/bootstrap-host.sh').read_text()
    result = subprocess.run(ssh(host) + ['sudo -n sh -s'], input=bootstrap, text=True, capture_output=True, timeout=900)
    runner.require(result.returncode == 0, 'SSH / sudo / Ubuntu / Python 引导失败；请核对已信任主机、免交互 sudo 和软件源网络')
    print('[create-project:mac] SSH 与构建机基础检查通过', flush=True)
    with tempfile.TemporaryDirectory(prefix='project-remote-') as temporary:
        work = Path(temporary)
        git(['bundle', 'create', str(work / 'template.bundle'), 'HEAD'])
        data = {'template_sha': sha, 'project': project, 'name': name.strip(), 'timeout': timeout, 'config': config}
        (work / 'request.json').write_text(json.dumps(data, ensure_ascii=False))
        (work / 'api-token').write_text(token)
        (work / 'request.json').chmod(0o600)
        (work / 'api-token').chmod(0o600)
        for filename in PAYLOAD:
            target = work / filename
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_text(git(['show', sha + ':' + filename], strip=False))
        archive = work / 'request.tar'
        with tarfile.open(archive, 'w') as package:
            for filename in (*PAYLOAD, 'template.bundle', 'request.json', 'api-token'):
                package.add(work / filename, arcname=filename)
        archive.chmod(0o600)
        with archive.open('rb') as stream:
            process = subprocess.Popen(ssh(host) + [shlex.join(['sudo', '-n', 'python3', '-c', RECEIVER])],
                                       stdin=stream, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True, bufsize=1)
            result = None
            for line in process.stdout:
                line = line.replace(token, '[REDACTED]')
                if line.startswith(PREFIX):
                    result = json.loads(line.removeprefix(PREFIX))
                else:
                    print(line, end='', flush=True)
            code = process.wait()
        runner.require(code == 0 and result and result['result']['phase'] == 'complete',
                       '远程初始化未完成；已保留项目和 CI 状态，请修复后重跑同一命令')
    runner.require(result['result']['template_sha'] == sha and result['result']['project_path'] == project
                   and result['temporary_credentials_removed'], '远端结果未通过输入绑定核对')
    key = hashlib.sha256((config['gitlab_url'] + '/' + project).encode()).hexdigest()[:24]
    receipt = Path(receipt).expanduser() if receipt else ROOT / 'output/project-bootstrap/remote' / (key + '.json')
    receipt.parent.mkdir(parents=True, exist_ok=True)
    runner.atomic_write(receipt, json.dumps(result, ensure_ascii=False, indent=2) + '\n')
    print(json.dumps({'project_url': result['result']['project_url'], 'pipeline_url': result['result']['pipeline_url'],
                      'template_sha': sha, 'receipt': str(receipt.absolute()), 'status': 'complete'}, ensure_ascii=False), flush=True)
    return result


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--config', default='~/.config/webapp-template/remote.json')
    parser.add_argument('--project', required=True)
    parser.add_argument('--name', required=True)
    parser.add_argument('--timeout', type=int, default=3600)
    parser.add_argument('--receipt', help='本地回执；默认按 GitLab / project 摘要分开保存')
    args = parser.parse_args()
    try:
        create(args.config, args.project, args.name, args.timeout, args.receipt)
        return 0
    except (runner.SetupError, OSError, ValueError, KeyError, TypeError, subprocess.SubprocessError) as exc:
        print('[create-project:mac] ' + (str(exc) if isinstance(exc, runner.SetupError) else type(exc).__name__), file=sys.stderr)
        return 1
    except KeyboardInterrupt:
        print('[create-project:mac] 已中断；远端 CI 可用同一命令回读', file=sys.stderr)
        return 130


if __name__ == '__main__':
    sys.exit(main())
