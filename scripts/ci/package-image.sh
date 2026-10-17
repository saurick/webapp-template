#!/usr/bin/env bash
set -euo pipefail
export GIT_OPTIONAL_LOCKS=0
ci_root="$(git rev-parse --show-toplevel)"
ci_variant="${1:?请提供 template 或 derived}"
[[ "${CI_COMMIT_SHA:-}" =~ ^[0-9a-f]{40}$ ]]
[[ "${CI_PIPELINE_ID:-}" =~ ^[0-9]+$ ]]
[[ "$(git rev-parse HEAD)" == "$CI_COMMIT_SHA" ]]
ci_source="$ci_root"
case "$ci_variant" in
template) ;;
derived)
	ci_source="$ci_root/output/ci/derived-build"
	[[ ! -e "$ci_source" ]]
	git clone --quiet "$ci_root/output/ci/derived.bundle" "$ci_source"
	python3 - "$ci_root/output/ci/derived.json" "$ci_source" <<'PY'
import json, os, subprocess, sys
metadata = json.load(open(sys.argv[1]))
assert metadata['source_sha'] == os.environ['CI_COMMIT_SHA']
assert metadata['pipeline_id'] == os.environ['CI_PIPELINE_ID']
assert metadata['fixture_only'] is True and metadata['init'] == metadata['strict'] == 'passed'
assert subprocess.check_output(['git', '-C', sys.argv[2], 'rev-parse', 'HEAD'], text=True).strip() == metadata['derived_sha']
PY
	;;
*)
	echo '[ci:package] 不支持的镜像类型' >&2
	exit 1
	;;
esac
[[ -z "$(git -C "$ci_source" status --porcelain=v1)" ]]
ci_source_sha="$(git -C "$ci_source" rev-parse HEAD)"
ci_image="${CI_PROJECT_PATH_SLUG:?}-$ci_variant:ci-$CI_PIPELINE_ID"
ci_output="$ci_root/output/ci/images"
mkdir -p "$ci_output"
ci_archive="$ci_output/$ci_variant-${CI_COMMIT_SHA:0:8}-linux-amd64.tar.gz"

make --silent -C "$ci_source/server" build_server \
	IMAGE_NAME="${ci_image%:*}" IMAGE_TAG="${ci_image##*:}" FIXED_TAG="${ci_image##*:}" \
	IMAGE_PLATFORM=linux/amd64 BUILD_PROXY="${HTTPS_PROXY:-${https_proxy:-}}" ALPINE_MIRROR="${ALPINE_MIRROR:-}"
ci_image_id="$(docker image inspect --format '{{.Id}}' "$ci_image")"
docker run --rm --platform linux/amd64 "$ci_image" /app/server -h
docker run --rm --platform linux/amd64 "$ci_image" /bin/sh -ec 'test -s /app/public/index.html && test -x /app/server'
docker image save "$ci_image" | gzip -1 >"$ci_archive"
docker image rm "$ci_image"
gzip -dc "$ci_archive" | docker image load
[[ "$(docker image inspect --format '{{.Id}}' "$ci_image")" == "$ci_image_id" ]]
python3 - "$ci_image" "$ci_source_sha" "$ci_archive" "$ci_variant" <<'PY'
import hashlib, json, os, pathlib, subprocess, sys
image, source, archive, variant = sys.argv[1:]
data = json.loads(subprocess.check_output(['docker', 'image', 'inspect', image], text=True))[0]
assert data['Os'] == 'linux' and data['Architecture'] == 'amd64'
environment = dict(item.split('=', 1) for item in data['Config']['Env'])
assert environment['GIT_SHA'] == source
assert not any(key.lower().endswith('_proxy') for key in environment)
history = subprocess.check_output(['docker', 'history', '--no-trunc', image], text=True)
for key in ['HTTP_PROXY', 'HTTPS_PROXY', 'http_proxy', 'https_proxy']:
    value = os.environ.get(key)
    assert not value or value not in history
file = pathlib.Path(archive)
digest = hashlib.sha256(file.read_bytes()).hexdigest()
file.with_suffix(file.suffix + '.sha256').write_text(digest + '  ' + file.name + '\n')
metadata = {'source_sha': source, 'pipeline_sha': os.environ['CI_COMMIT_SHA'], 'pipeline_id': os.environ['CI_PIPELINE_ID'], 'variant': variant, 'fixture_only': variant == 'derived', 'image': image, 'image_id': data['Id'], 'platform': 'linux/amd64', 'archive': file.name, 'sha256': digest, 'load': 'passed', 'binary_and_web': 'passed', 'proxy_absent': True}
file.with_name(variant + '.json').write_text(json.dumps(metadata, indent=2) + '\n')
print(json.dumps(metadata))
PY
