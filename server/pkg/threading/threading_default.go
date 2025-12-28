// 管理临时异步线程，确保进程退出时，线程可以被正确退出
package threading

import (
	"context"
	"errors"
	"time"
)

var errRepeatedInit = errors.New("errRepeatedInit")
var defaultThreading *Threading = nil

const (
	// 程序退出时，有 30s 时间来处理子线程为完成的任务
	defaultThreadingStopTimeout = time.Second * 30
)

func Init() func() {
	if defaultThreading != nil {
		panic(errRepeatedInit)
	}
	defaultThreading = New()
	return func() {
		defaultThreading.Stop(true, defaultThreadingStopTimeout)
	}
}

// 新建后台线程，对线程进行管理，程序退出前会有10s时间等待才退出
//
// ctx: 调用位置的上下文
// run(ctx): 回调中的 ctx 脱离了原上下文的 WithCancel，但是包含了 Threading 的 WithCancel
func Go(ctx context.Context, run func(ctx context.Context), panicFunc ...func(ctx context.Context, err interface{})) {
	defaultThreading.Go(ctx, run, panicFunc...)
}
