#!/usr/bin/env python3
"""只读核对 namespace 身份、Owner 权限与初始化 token scopes。"""

from datetime import date
from urllib.parse import quote


def check(api, path, require):
    namespace, project = path.rsplit("/", 1)
    token = api.call("GET", "/personal_access_tokens/self")
    require(token.get("active") and not token.get("revoked"), "namespace token 已失效")
    require({"api", "create_runner", "manage_runner", "write_repository"} <= set(token["scopes"]),
            "namespace token 缺少 api/create_runner/manage_runner/write_repository scopes")
    require(not token.get("expires_at") or date.fromisoformat(token["expires_at"]) >= date.today(),
            "namespace token 已过期")
    user = api.call("GET", "/user")
    matches = [n for n in api.items("/namespaces?search=" + quote(namespace.rsplit("/", 1)[-1], safe=""))
               if n["full_path"] == namespace]
    require(len(matches) == 1, "namespace 不可见；请核对路径与 token 授权")
    target = matches[0]
    if target["kind"] == "group":
        group = api.call("GET", f"/groups/{target['id']}")
        member = api.call("GET", f"/groups/{target['id']}/members/all/{user['id']}")
        require(group["full_path"] == namespace and member["access_level"] == 50,
                "组初始化需要目标组的 Owner 授权；不会自动提权")
        require(group.get("project_creation_level") in ("developer", "maintainer"),
                "目标组未开放项目创建；请按 namespace 策略配置")
    else:
        require(target["kind"] == "user" and namespace == user["username"],
                "个人 namespace 必须属于 token 当前用户")
        require(user.get("can_create_project") is True, "当前用户不能创建项目；请核对配额与实例策略")
    return {"namespace": namespace, "namespace_id": target["id"], "kind": target["kind"],
            "token_id": token["id"], "expires_at": token.get("expires_at"), "authorization": "passed"}
