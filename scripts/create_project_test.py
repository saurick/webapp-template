import copy
import importlib.util
import json
import os
from pathlib import Path
import subprocess
import tempfile
import unittest
from unittest.mock import patch

spec=importlib.util.spec_from_file_location('create_project',Path(__file__).with_name('create-project.py'))
module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module)

class FakeAPI:
    def __init__(self):
        self.project=None;self.creates=0;self.head='';self.status='success';self.runner_id=77
        self.names=['validate_template','initialize_project','package_template','package_derived']
        self.trace=[]
    def items(self,path):
        if path.startswith('/namespaces'):return [{'id':9,'full_path':'team'}]
        if '/jobs?' in path:
            return [{'id':i+100,'name':name,'status':self.status,'allow_failure':False,'runner':{'id':self.runner_id},
                     'web_url':'https://gitlab.example.com/job/'+str(i),'artifacts_file':{'size':10}} for i,name in enumerate(self.names)]
        raise AssertionError(path)
    def call(self,method,path,data=None,missing_ok=False):
        self.trace.append((method,path,copy.deepcopy(data)))
        if path=='/projects/team%2Fstarter':return copy.deepcopy(self.project)
        if path=='/projects' and method=='POST':
            self.creates+=1
            self.project={**data,'id':42,'path_with_namespace':'team/starter','archived':False,'web_url':'https://gitlab.example.com/team/starter'}
            return copy.deepcopy(self.project)
        if path.startswith('/projects/42/pipelines?'):
            return [{'id':88,'status':self.status}]
        if path=='/projects/42/pipelines/88':
            return {'id':88,'sha':self.head,'ref':'main','status':self.status,'web_url':'https://gitlab.example.com/pipeline/88'}
        if path.endswith('/repository/branches/main'):
            return {'protected':True,'commit':{'id':self.head}}
        if path.endswith('artifacts/output/ci/derived.json'):
            return {'source_sha':self.head,'derived_sha':'d'*40,'pipeline_id':'88','init':'passed','strict':'passed','fixture_only':True}
        if '/artifacts/output/ci/images/' in path:
            variant=path.split('/')[-1].removesuffix('.json')
            return {'pipeline_sha':self.head,'pipeline_id':'88','source_sha':self.head if variant=='template' else 'd'*40,
                    'variant':variant,'load':'passed','binary_and_web':'passed','proxy_absent':True,'platform':'linux/amd64',
                    'sha256':'a'*64,'config_digest':'sha256:'+'b'*64}
        raise AssertionError((method,path))

class CreateProjectTests(unittest.TestCase):
    def setUp(self):
        self.temp=tempfile.TemporaryDirectory(prefix='create-project-test-');self.addCleanup(self.temp.cleanup)
        self.root=Path(self.temp.name).resolve();self.source=self.root/'template';self.source.mkdir();(self.source/'config').mkdir()
        (self.source/'config/dev-ports.env').write_text('DEV_PROJECT_ID=webapp-template\n')
        self.init_git(self.source)
        self.target=self.root/'starter';self.journal=self.root/'journals';self.api=FakeAPI();self.remote='';self.pushes=0;self.registers=0
        self.config={'gitlab_url':'https://gitlab.example.com','api_token_file':str(self.root/'token'),'environment':{},'extra_hosts':[]}
        self.real_prepare=module.prepare_source
        patches=[patch.object(module,'ROOT',self.source),patch.object(module,'JOURNALS',self.journal),
                 patch.object(module.runner,'API',return_value=self.api),patch.object(module,'prepare_source',side_effect=self.prepare),
                 patch.object(module.runner,'setup',side_effect=self.setup_runner),patch.object(module,'remote_git',side_effect=self.remote_git)]
        for p in patches:p.start();self.addCleanup(p.stop)
    def init_git(self,path):
        subprocess.run(['git','init','--quiet','-b','main'],cwd=path,check=True)
        subprocess.run(['git','add','.'],cwd=path,check=True)
        subprocess.run(['git','-c','user.name=Test','-c','user.email=test@example.invalid','commit','--quiet','--allow-empty','-m','test: baseline'],cwd=path,check=True)
    def prepare(self,source,sha,target,project_id,name,creation_id,journal):
        if not target.exists():
            target.mkdir();(target/'.project-bootstrap.json').write_text(json.dumps({'creation_id':creation_id,'template_sha':sha}))
            self.init_git(target)
        self.api.head=module.git(['rev-parse','HEAD'],target)
        return self.api.head
    def setup_runner(self,*args,**kwargs):
        self.registers+=1
        return {'runner_id':77,'service':'project-42','status':'online'}
    def remote_git(self,args,directory,env):
        if args[0]=='ls-remote':return self.remote
        if args[0]=='push':self.pushes+=1;self.remote=self.api.head+'\trefs/heads/main'
        return ''
    def create(self,**overrides):
        return module.create(self.config,'team/starter','新项目',overrides.get('target',self.target),timeout=60)
    def test_one_command_creates_private_project_registers_pushes_and_verifies_ci(self):
        result=self.create()
        self.assertEqual(result['phase'],'complete');self.assertEqual(result['deployment'],'unconfigured')
        self.assertEqual(self.api.creates,1);self.assertEqual(self.pushes,1)
        params=next(row[2] for row in self.api.trace if row[:2]==('POST','/projects'))
        self.assertEqual(params['visibility'],'private');self.assertFalse(params['initialize_with_readme'])
        self.assertFalse(params['shared_runners_enabled']);self.assertFalse(params['group_runners_enabled'])
        self.assertEqual(len(result['artifacts']['images']),2)
        self.assertNotIn('token',json.dumps(result))
    def test_repeat_resumes_same_project_commit_runner_and_pipeline(self):
        first=self.create();second=self.create()
        self.assertEqual(first['initial_sha'],second['initial_sha']);self.assertEqual(first['pipeline_id'],second['pipeline_id'])
        self.assertEqual(self.api.creates,1);self.assertEqual(self.pushes,1)
    def test_unrelated_existing_project_is_not_adopted(self):
        self.api.project={'id':99,'path_with_namespace':'team/starter','visibility':'private','archived':False,'description':'another project'}
        with self.assertRaisesRegex(module.runner.SetupError,'拒绝接管'):self.create()
        self.assertFalse(self.target.exists());self.assertEqual(self.registers,0)
    def test_existing_directory_is_preserved(self):
        self.target.mkdir();(self.target/'unique.txt').write_text('keep')
        with self.assertRaisesRegex(module.runner.SetupError,'拒绝覆盖'):self.create()
        self.assertEqual((self.target/'unique.txt').read_text(),'keep');self.assertEqual(self.api.creates,0)
    def test_failed_ci_blocks_and_can_be_read_after_external_resolution(self):
        self.api.status='failed'
        with self.assertRaisesRegex(module.runner.SetupError,'流水线未通过'):self.create()
        self.assertEqual(self.api.creates,1);self.assertEqual(self.pushes,1)
        self.api.status='success';self.assertEqual(self.create()['phase'],'complete')
        self.assertEqual(self.api.creates,1);self.assertEqual(self.pushes,1)
    def test_remote_advancement_stops_without_force_push(self):
        self.remote='f'*40+'\trefs/heads/main'
        with self.assertRaisesRegex(module.runner.SetupError,'拒绝覆盖'):self.create()
        self.assertEqual(self.pushes,0)
    def test_required_jobs_and_runner_bindings_are_enforced(self):
        self.api.names=self.api.names[:-1]
        with self.assertRaisesRegex(module.runner.SetupError,'必要 job'):self.create()
        self.api.names.append('package_derived');self.api.runner_id=999
        with self.assertRaisesRegex(module.runner.SetupError,'必要 job'):self.create()
    def test_changed_arguments_or_worktree_are_not_overwritten(self):
        self.create();(self.target/'unique.txt').write_text('keep')
        with self.assertRaisesRegex(module.runner.SetupError,'源码已有修改'):self.create()
        (self.target/'unique.txt').unlink()
        with self.assertRaisesRegex(module.runner.SetupError,'参数或模板版本'):self.create(target=self.root/'another')
    def test_credential_is_read_only_by_askpass_and_not_saved_in_remote(self):
        private=self.root/'private';private.mkdir(mode=0o700)
        token=self.root/'token';token.write_text('fixture-credential');token.chmod(0o600)
        env=module.auth_env(self.config,private)
        script=env['GIT_ASKPASS']
        self.assertEqual(subprocess.check_output([script,'Username:'],env=env,text=True).strip(),'oauth2')
        self.assertEqual(subprocess.check_output([script,'Password:'],env=env,text=True).strip(),'fixture-credential')
        self.assertNotIn('fixture-credential',Path(script).read_text());self.assertNotIn('fixture-credential',json.dumps(env))
        self.assertEqual(Path(script).stat().st_mode&0o777,0o700)
    def test_unfinished_source_edits_and_index_changes_are_detected(self):
        self.target.mkdir();(self.target/'file.txt').write_text('baseline')
        sha=module.git(['rev-parse','HEAD'],self.source)
        (self.target/'.project-bootstrap.json').write_text(json.dumps({'creation_id':'proof','template_sha':sha}))
        self.init_git(self.target)
        self.journal.mkdir(mode=0o700)
        baseline=module.source_checkpoint(self.target)
        module.runner.atomic_write(self.journal/'source-checkpoint.json',json.dumps(baseline))
        (self.target/'file.txt').write_text('user edit')
        with self.assertRaisesRegex(module.runner.SetupError,'拒绝自动暂存'):
            self.real_prepare(self.source,sha,self.target,'starter','项目','proof',self.journal)
        self.assertEqual((self.target/'file.txt').read_text(),'user edit')
        self.assertEqual(baseline['index'],module.source_checkpoint(self.target)['index'])
        (self.target/'file.txt').write_text('baseline')
        self.assertEqual(baseline,module.source_checkpoint(self.target))
        (self.target/'new.txt').write_text('unique file')
        self.assertNotEqual(baseline,module.source_checkpoint(self.target))
        module.runner.atomic_write(self.journal/'source-checkpoint.json',json.dumps(module.source_checkpoint(self.target)))
        subprocess.run(['git','add','new.txt'],cwd=self.target,check=True)
        indexed=module.source_checkpoint(self.target)
        with self.assertRaisesRegex(module.runner.SetupError,'拒绝自动暂存'):
            self.real_prepare(self.source,sha,self.target,'starter','项目','proof',self.journal)
        self.assertEqual(indexed,module.source_checkpoint(self.target))

    def test_pipeline_timeout_does_not_create_another_pipeline(self):
        self.api.head='a'*40
        state={}
        old=self.api.call
        def call(method,path,data=None,missing_ok=False):
            return [] if '/pipelines?' in path else old(method,path,data,missing_ok)
        with patch.object(self.api,'call',side_effect=call),patch.object(module.time,'monotonic',side_effect=[0,61]):
            with self.assertRaisesRegex(module.runner.SetupError,'等待 CI 超时'):
                module.wait_pipeline(self.api,42,self.api.head,77,state,lambda:None,60)
        self.assertFalse(any(method=='POST' and 'pipelines' in path for method,path,_ in self.api.trace))

if __name__=='__main__':unittest.main()
