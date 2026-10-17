package v1

import "fmt"

// Redact 供 Kratos logging.Redacter 使用，只记录元信息，避免参数中的凭据进入日志。
func (r *GetJsonrpcRequest) Redact() string {
	return rpcLogMetadata(r.GetUrl(), r.GetMethod(), r.GetId())
}

// Redact 对 POST 请求使用与 GET 相同的日志边界，不改变业务处理收到的参数。
func (r *PostJsonrpcRequest) Redact() string {
	return rpcLogMetadata(r.GetUrl(), r.GetMethod(), r.GetId())
}

func rpcLogMetadata(url, method, id string) string {
	return fmt.Sprintf("url=%q method=%q id=%q", url, method, id)
}
