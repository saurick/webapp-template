import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import {
  applyProjectConfiguration,
  planProjectConfiguration,
} from "./configure-project.mjs";

// 工程骨架只保留无凭据配置；生产连接和管理员密码由私有覆盖文件承接。
export function prepareProject({
  rootDir,
  projectId,
  name,
  sourceSha,
  creationId,
}) {
  const plan = planProjectConfiguration({ rootDir, projectId, name });
  applyProjectConfiguration(plan);
  const replacements = [
    ["webapp-template", projectId],
    ["webapp_template", projectId.replaceAll("-", "_")],
    ["your-project", projectId],
    ["template-server", `${projectId}-server`],
    ["test_database_atlas", projectId.replaceAll("-", "_")],
    ["registry.example.com", "registry.invalid"],
    ["registry.xxxx", "registry.invalid"],
    ["deploy.example.com", "deploy.invalid"],
    ["dashboard.example.local", "dashboard.invalid"],
    ["otel-collector.observability.svc.cluster.local", "localhost"],
    ["prometheus:9090", "localhost:9090"],
  ];
  function clean(file, relative) {
    let text = fs.readFileSync(file, "utf8");
    for (const [from, to] of replacements) text = text.replaceAll(from, to);
    if (file.endsWith(".md"))
      text = text.replaceAll("`replace-me`", "`issuer-name`");
    if (/\.(?:yaml|yml)$/u.test(file) && !file.endsWith(".example")) {
      text = text.replace(/^(\s*(?:dsn|jwtSecret|password):).*$/gmu, '$1 ""');
      text = text.replace(/^.*#.*(?:replace-me|base64-user-pass).*\n?/gmu, "");
    }
    if (/config\.local\.example\.yaml$/u.test(file)) {
      text = text.replace(/^(\s*(?:dsn|jwtSecret|password):).*$/gmu, '$1 ""');
    }
    if (relative === "server/deploy/compose/prod/compose.yml") {
      text = text.replace(
        /\$\{(POSTGRES_PASSWORD|POSTGRES_DSN|WEBAPP_JWT_SECRET):-[^}]+\}/gu,
        (_value, key) => `\${${key}:?请在私有环境文件配置 ${key}}`,
      );
    }
    if (relative.endsWith(".env.example")) {
      text = text.replace(
        /^(POSTGRES_PASSWORD|POSTGRES_DSN|WEBAPP_JWT_SECRET)=.*$/gmu,
        "$1=",
      );
    }
    fs.writeFileSync(file, text);
  }
  function visit(relative) {
    const directory = path.join(rootDir, relative);
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const next = path.posix.join(relative, entry.name);
      if (entry.isSymbolicLink()) throw new Error("工程骨架不接受符号链接");
      if (entry.isDirectory()) visit(next);
      else clean(path.join(rootDir, next), next);
    }
  }
  visit("server/deploy");
  visit("server/configs");
  clean(path.join(rootDir, "server/docs/k8s.md"), "server/docs/k8s.md");
  fs.writeFileSync(
    path.join(rootDir, ".project-bootstrap.json"),
    JSON.stringify(
      {
        schema: 1,
        creation_id: creationId,
        template_sha: sourceSha,
        project_id: projectId,
        deployment: "unconfigured",
        credentials: "private-config-required",
      },
      null,
      2,
    ) + "\n",
  );
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href
) {
  const [rootDir, projectId, name, sourceSha, creationId] =
    process.argv.slice(2);
  prepareProject({ rootDir, projectId, name, sourceSha, creationId });
}
