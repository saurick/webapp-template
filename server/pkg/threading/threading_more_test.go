package threading

import (
	"context"
	"testing"
	"time"
)

// 验证在 Stop(true, timeout) 之后再调用 Go 会 panic
func TestGoAfterStopPanics(t *testing.T) {
	th := New()
	th.Stop(true, 0)

	defer func() {
		r := recover()
		if r != ErrStopped {
			t.Fatalf("expected panic ErrStopped, got: %v", r)
		}
	}()

	th.Go(context.Background(), func(ctx context.Context) {})
}

// 验证外部父 context 被取消后，Threading 启动的 goroutine 仍然会执行
func TestContextCancelDoesNotCancelRun(t *testing.T) {
	ctx, cancel := context.WithCancel(context.Background())
	cancel() // 取消父 context

	done := make(chan struct{})
	th := New()
	th.Go(ctx, func(ctx context.Context) {
		close(done)
	})

	select {
	case <-done:
		// ok
	case <-time.After(200 * time.Millisecond):
		t.Fatalf("run did not execute after parent context canceled")
	}

	th.Stop(true, 0)
}

// 验证 Stop(false, ...) 会立即取消正在运行的任务（无需等待）
func TestStopImmediateCancel(t *testing.T) {
	th := New()
	started := make(chan struct{})
	canceled := make(chan struct{})

	th.Go(context.Background(), func(ctx context.Context) {
		close(started)
		select {
		case <-ctx.Done():
			close(canceled)
		case <-time.After(500 * time.Millisecond):
			// 如果没有被取消则超时退出（测试会认为失败）
		}
	})

	select {
	case <-started:
	case <-time.After(200 * time.Millisecond):
		t.Fatalf("goroutine did not start")
	}

	th.Stop(false, 0)

	select {
	case <-canceled:
		// ok
	case <-time.After(200 * time.Millisecond):
		t.Fatalf("expected cancellation but didn't receive it")
	}
}

// 验证 Stop(true, timeout) 在超时后会取消仍未完成的任务
func TestStopWaitTimeoutCancels(t *testing.T) {
	th := New()
	started := make(chan struct{})
	canceled := make(chan struct{})
	block := make(chan struct{})

	th.Go(context.Background(), func(ctx context.Context) {
		close(started)
		select {
		case <-ctx.Done():
			close(canceled)
		case <-block:
			// pretend work finished (we won't close block)
		}
	})

	select {
	case <-started:
	case <-time.After(200 * time.Millisecond):
		t.Fatalf("goroutine did not start")
	}

	// 等待很短时间并触发超时分支
	th.Stop(true, 50*time.Millisecond)

	select {
	case <-canceled:
		// ok: 被取消
	case <-time.After(300 * time.Millisecond):
		t.Fatalf("expected cancellation after timeout")
	}
}

// 验证 goroutine panic 之后调用 Stop(true, timeout) 依然能够按期返回
func TestStopAfterPanicReturns(t *testing.T) {
	th := New()
	panicNotified := make(chan struct{})

	th.Go(context.Background(), func(ctx context.Context) {
		panic("boom")
	}, func(ctx context.Context, err interface{}) {
		close(panicNotified)
	})

	select {
	case <-panicNotified:
		// panic 已经被捕获
	case <-time.After(200 * time.Millisecond):
		t.Fatalf("panic handler was not invoked")
	}

	stopped := make(chan struct{})
	go func() {
		th.Stop(true, 50*time.Millisecond)
		close(stopped)
	}()

	select {
	case <-stopped:
		// ok
	case <-time.After(300 * time.Millisecond):
		t.Fatalf("Stop did not return after panic")
	}
}

// 验证 Stop 可被多次调用，且第二次调用不会阻塞
func TestStopMultipleCalls(t *testing.T) {
	th := New()
	started := make(chan struct{})

	th.Go(context.Background(), func(ctx context.Context) {
		close(started)
		<-ctx.Done()
	})

	select {
	case <-started:
	case <-time.After(200 * time.Millisecond):
		t.Fatalf("goroutine did not start")
	}

	th.Stop(false, 0)

	done := make(chan struct{})
	go func() {
		th.Stop(true, 50*time.Millisecond)
		close(done)
	}()

	select {
	case <-done:
	case <-time.After(200 * time.Millisecond):
		t.Fatalf("second Stop call did not return")
	}
}

// 验证部分 goroutine 正常完成、部分被 Stop(true, timeout) 取消的场景
func TestStopTimeoutPartialCompletion(t *testing.T) {
	th := New()
	finished := make(chan struct{})
	canceled := make(chan struct{})

	th.Go(context.Background(), func(ctx context.Context) {
		close(finished)
	})

	block := make(chan struct{})
	th.Go(context.Background(), func(ctx context.Context) {
		select {
		case <-ctx.Done():
			close(canceled)
		case <-block:
		}
	})

	select {
	case <-finished:
	case <-time.After(200 * time.Millisecond):
		t.Fatalf("fast goroutine did not finish")
	}

	th.Stop(true, 50*time.Millisecond)

	select {
	case <-canceled:
		// 被取消
	case <-time.After(300 * time.Millisecond):
		t.Fatalf("slow goroutine was not canceled by Stop timeout")
	}
}
