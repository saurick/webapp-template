import hashlib
import importlib.util
import io
import json
import os
from pathlib import Path
import subprocess
import sys
import tarfile
import tempfile
import unittest
from unittest.mock import patch

ROOT=Path(__file__).resolve().parents[1]
def load(name,path):
    spec=importlib.util.spec_from_file_location(name,path);module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module);return module
client=load('remote_client_test',ROOT/'scripts/create-project-remote.py')
agent=load('remote_agent_test',ROOT/'scripts/ci/remote-create.py')
auth=load('namespace_test',ROOT/'scripts/ci/check-namespace.py')
host=load('host_test',ROOT/'scripts/ci/prepare-host.py')
runner=client.runner

class API:
    def __init__(self):
        self.scopes=['api','create_runner','manage_runner','write_repository'];self.level=50;self.expires='2099-01-01';self.kind='group';self.writes=[]
    def items(self,path):return [{'id':9,'full_path':'team','kind':self.kind}]
    def call(self,method,path):
        if method!='GET':self.writes.append(method)
        if path=='/personal_access_tokens/self':return {'id':1,'active':True,'revoked':False,'scopes':self.scopes,'expires_at':self.expires}
        if path=='/user':return {'id':11,'username':'other','can_create_project':True}
        if path=='/groups/9':return {'full_path':'team','project_creation_level':'maintainer'}
        if path=='/groups/9/members/all/11':return {'access_level':self.level}
        raise AssertionError(path)

class RemoteTests(unittest.TestCase):
    def setUp(self):
        self.temp=tempfile.TemporaryDirectory(prefix='remote-project-test-');self.addCleanup(self.temp.cleanup);self.root=Path(self.temp.name).resolve()
    def test_namespace_owner_and_scopes_are_checked_without_writes(self):
        api=API();result=auth.check(api,'team/starter',runner.require);self.assertEqual(result['authorization'],'passed');self.assertEqual(api.writes,[])
        for key,value in [('level',40),('scopes',['api']),('expires','2000-01-01'),('kind','user')]:
            api=API();setattr(api,key,value)
            with self.subTest(key=key),self.assertRaises(runner.SetupError):auth.check(api,'team/starter',runner.require)
            self.assertEqual(api.writes,[])
    def test_ssh_options_cannot_be_injected_and_private_config_is_required(self):
        token=self.root/'token';token.write_text('fixture-local-only');token.chmod(0o600)
        config=self.root/'config';data={'ssh_host':'builder','gitlab_url':'https://gitlab.example.com','api_token_file':str(token)}
        config.write_text(json.dumps(data));config.chmod(0o600)
        selected,settings,value=client.load_config(config)
        self.assertEqual(selected,'builder');self.assertNotIn('api_token_file',settings);self.assertEqual(value,'fixture-local-only')
        data['ssh_host']='-oProxyCommand=anything';config.write_text(json.dumps(data))
        with self.assertRaises(runner.SetupError):client.load_config(config)
        data['ssh_host']='builder';config.write_text(json.dumps(data));config.chmod(0o644)
        with self.assertRaises(runner.SetupError):client.load_config(config)
    def receive(self,script,malicious=False):
        base=self.root/'incoming';base.mkdir(mode=0o700,exist_ok=True)
        code=client.RECEIVER.replace("Path('/var/lib/webapp-template-remote')",repr(base).replace('PosixPath','Path')).replace('st_uid==0','st_uid==os.geteuid()')
        package=io.BytesIO()
        with tarfile.open(fileobj=package,mode='w') as archive:
            for name in (*client.PAYLOAD,'request.json','template.bundle','api-token'):
                content=script.encode() if name=='scripts/ci/remote-create.py' else b'fixture-local-only'
                entry=tarfile.TarInfo(name);entry.size=len(content);entry.mode=0o600;archive.addfile(entry,io.BytesIO(content))
            if malicious:
                entry=tarfile.TarInfo('../escape');entry.size=1;archive.addfile(entry,io.BytesIO(b'x'))
        result=subprocess.run([sys.executable,'-c',code],input=package.getvalue(),capture_output=True)
        self.assertEqual(list(base.iterdir()),[]);self.assertFalse((self.root/'escape').exists())
        self.assertNotIn(b'fixture-local-only',result.stdout+result.stderr)
        return result
    def test_receiver_removes_private_upload_after_success_and_failure(self):
        script="def main(stage):\n assert (stage/'api-token').stat().st_mode&0o777==0o600\n return ({'ok':True},0)\n"
        self.assertEqual(self.receive(script).returncode,0)
        self.assertNotEqual(self.receive("def main(stage): raise ValueError('private error')\n").returncode,0)
        self.assertNotEqual(self.receive(script,malicious=True).returncode,0)
    def test_receiver_cleans_credentials_on_termination(self):
        result=self.receive('import os,signal\ndef main(stage): os.kill(os.getpid(),signal.SIGTERM)\n')
        self.assertEqual(result.returncode,130)
    def test_exact_bundle_installs_and_reuses_clean_source_refuses_foreign_edits(self):
        source=self.root/'source';source.mkdir();(source/'file').write_text('baseline')
        env={**os.environ,'GIT_OPTIONAL_LOCKS':'0'}
        subprocess.run(['git','init','--quiet','-b','main'],cwd=source,env=env,check=True)
        subprocess.run(['git','add','.'],cwd=source,env=env,check=True)
        subprocess.run(['git','-c','user.name=Test','-c','user.email=test@example.invalid','commit','--quiet','-m','test: baseline'],cwd=source,env=env,check=True)
        sha=subprocess.check_output(['git','rev-parse','HEAD'],cwd=source,text=True).strip();bundle=self.root/'source.bundle'
        subprocess.run(['git','bundle','create',str(bundle),'HEAD'],cwd=source,env=env,check=True)
        with patch.object(agent,'SOURCES',self.root/'installed'):
            target=agent.install_source(bundle,sha,runner)
            self.assertEqual(agent.install_source(bundle,sha,runner),target)
            (target/'file').write_text('user edit')
            with self.assertRaises(runner.SetupError):agent.install_source(bundle,sha,runner)
            self.assertEqual((target/'file').read_text(),'user edit')
    def test_invalid_authorization_prevents_host_or_source_mutation(self):
        stage=self.root/'stage';(stage/'scripts/ci').mkdir(parents=True)
        request={'template_sha':'a'*40,'project':'team/starter','name':'项目','timeout':60,'config':{'gitlab_url':'https://gitlab.example.com'}}
        for name,content in [('request.json',json.dumps(request)),('api-token','fixture-local-only')]:
            (stage/name).write_text(content);(stage/name).chmod(0o600)
        api=API();api.level=10
        with patch.object(agent.platform,'system',return_value='Linux'),patch.object(agent.platform,'machine',return_value='x86_64'),patch.object(agent.os,'geteuid',return_value=0),patch.object(runner,'private_read',side_effect=lambda p:Path(p).read_text()),patch.object(runner,'API',return_value=api),patch.object(agent,'load',return_value=auth) as loader:
            with self.assertRaises(runner.SetupError):agent.execute(stage,runner)
            self.assertEqual(loader.call_count,1)
        self.assertFalse((self.root/'installed').exists())
    def test_host_reuses_services_and_installs_verified_node_without_global_replacement(self):
        stage=self.root/'stage';(stage/'server/deploy/ci-runner').mkdir(parents=True)
        (stage/'.n-node-version').write_text('24.21.0\n')
        (stage/'server/deploy/ci-runner/host-tools.json').write_text((ROOT/'server/deploy/ci-runner/host-tools.json').read_text())
        data=io.BytesIO()
        with tarfile.open(fileobj=data,mode='w:xz') as archive:
            item=tarfile.TarInfo('node-v24.21.0-linux-x64/bin/node');item.size=1;item.mode=0o755;archive.addfile(item,io.BytesIO(b'x'))
        archive_bytes=data.getvalue();digest=hashlib.sha256(archive_bytes).hexdigest();calls=[]
        def run(args,**kwargs):
            calls.append(args)
            if args[0]=='curl':
                path=Path(args[-1]);path.write_bytes((digest+'  node-v24.21.0-linux-x64.tar.xz\n').encode() if args[-3].endswith('SHASUMS256.txt') else archive_bytes)
                value=''
            elif args[:2]==['docker','version']:value='29.1.3'
            elif args[:2]==['docker','info']:value='linux/x86_64'
            elif args[-1]=='--version':value='Version: 19.3.0' if 'gitlab-runner' in args[0] else 'v24.21.0'
            else:value=''
            return subprocess.CompletedProcess(args,0,value,'')
        with patch.object(host,'TOOLS',self.root/'tools'),patch.object(host,'STATE',self.root/'host-state'),patch.object(host.shutil,'which',side_effect=lambda executable:'/usr/bin/'+executable),patch.object(host.subprocess,'run',side_effect=run):
            first=host.prepare({'environment':{}},stage,runner);second=host.prepare({'environment':{}},stage,runner)
        self.assertIn('install official checksum-verified isolated Node',first['actions']);self.assertNotIn('install official checksum-verified isolated Node',second['actions'])
        self.assertFalse(first['existing_services_restarted']);self.assertFalse(any(c[0]=='systemctl' for c in calls))
        self.assertEqual(sum(c[0]=='curl' for c in calls),2)
        def corrupt(args,**kwargs):
            result=run(args,**kwargs)
            if args[0]=='curl' and args[-3].endswith('.tar.xz'):Path(args[-1]).write_bytes(b'corrupt download')
            return result
        with patch.object(host,'TOOLS',self.root/'bad-tools'),patch.object(host,'STATE',self.root/'bad-state'),patch.object(host.shutil,'which',side_effect=lambda executable:'/usr/bin/'+executable),patch.object(host.subprocess,'run',side_effect=corrupt):
            with self.assertRaisesRegex(runner.SetupError,'Node 下载校验失败'):host.prepare({'environment':{}},stage,runner)
        self.assertFalse((self.root/'bad-tools/node-v24.21.0').exists())

if __name__=='__main__':unittest.main()
