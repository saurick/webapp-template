// 管理临时异步线程，确保进程退出时，线程可以被正确退出
package threading

import (
	"context"
	"errors"
	"fmt"
	"runtime"
	"sync"
	"time"

	"github.com/go-kratos/kratos/v2/log"
)

var ErrStopped = errors.New("ErrStopped")

type Threading struct {
	lock    *sync.Mutex
	wait    *sync.WaitGroup
	stoped  bool // 是否已停止
	running map[context.Context]context.CancelFunc
}

func New() *Threading {
	return &Threading{
		lock:    &sync.Mutex{},
		wait:    &sync.WaitGroup{},
		running: make(map[context.Context]context.CancelFunc),
	}
}

func DefaultPanicFunc(ctx context.Context, err interface{}) {
	buf := make([]byte, 10240)
	runtime.Stack(buf, false)
	log.WithContext(ctx, log.GetLogger()).Log(log.LevelError, "msg", fmt.Sprintf("stack: %v\n%s", err, string(buf)))
}

// 新建后台线程，对线程进行管理，程序退出前可设置退出等待时间
//
// ctx: 调用位置的上下文
// run(ctx): 回调中的 ctx 脱离了原上下文的 WithCancel，但是包含了 Threading 的 WithCancel
// panicFunc(err): painc 回调
func (t *Threading) Go(ctx context.Context, run func(ctx context.Context), panicFunc ...func(ctx context.Context, err interface{})) {
	t.lock.Lock()
	if t.stoped {
		panic(ErrStopped)
	}
	ctxWithValue := context.WithoutCancel(ctx)         // 取消原上线文的 cancel，只保留 value
	ctxNew, cancel := context.WithCancel(ctxWithValue) // 重新套用 cancel，使其可在 Threading 中可控
	t.running[ctxNew] = cancel
	t.lock.Unlock()

	t.wait.Add(1)
	go func() {

		defer func() {
			if err := recover(); err != nil {
				pf := []func(context.Context, interface{}){DefaultPanicFunc}
				if len(panicFunc) > 0 {
					pf = panicFunc
				}
				for _, f := range pf {
					f(ctxNew, err)
				}
			}
		}()

		// 在执行任务前检查是否已被取消，避免执行已取消的任务
		// if ctxNew.Err() != nil {
		// 	t.lock.Lock()
		// 	delete(t.running, ctxNew)
		// 	t.lock.Unlock()
		// 	t.wait.Done()
		// 	return
		// }

		run(ctxNew)

		t.lock.Lock()
		delete(t.running, ctxNew)
		t.lock.Unlock()

		t.wait.Done()
	}()
}

// 程序退出前，停止所有线程
// wait: 等待所有线程执行完毕
// timeout: 等待超时，取消未执行完毕的任务
func (t *Threading) Stop(wait bool, timeout time.Duration) {
	t.lock.Lock()
	t.stoped = true
	t.lock.Unlock()

	if !wait {
		// 如果不等待，直接取消所有任务
		t.lock.Lock()
		for _, cancel := range t.running {
			cancel()
		}
		t.lock.Unlock()
		return
	}

	cancelChan := make(chan struct{})
	go func() {
		t.wait.Wait()
		select {
		case cancelChan <- struct{}{}:
		default:
		}
	}()
	go func() {
		time.Sleep(timeout)
		select {
		case cancelChan <- struct{}{}:
		default:
		}
	}()

	<-cancelChan // 等待超时或所有任务完成

	// 取消所有剩余任务
	t.lock.Lock()
	for _, cancel := range t.running {
		cancel()
	}
	t.lock.Unlock()
}
