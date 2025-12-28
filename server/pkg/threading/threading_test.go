package threading

import (
	"context"
	"log"
	"sync"
	"sync/atomic"
	"testing"
	"time"
)

func TestDefaultThreading(t *testing.T) {
	// 初始化线程池
	cleanupThreading := Init()
	defer cleanupThreading()

	Go(context.Background(), func(ctx context.Context) {
		// do something
	})
}

func TestThreading(t *testing.T) {

	type testKey string
	ctx := context.WithValue(context.TODO(), testKey("key"), "test_value")

	thread := New()
	count := int64(0)
	ctxOld := ctx
	thread.Go(ctxOld, func(ctx context.Context) {
		if ctxOld == ctx {
			t.Fail()
		}
		v, ok := ctx.Value(testKey("key")).(string)
		if !ok || v != "test_value" {
			t.Fail()
		}
		time.Sleep(time.Millisecond * 50)
		atomic.AddInt64(&count, 1)
	})
	thread.Go(ctx, func(ctx context.Context) {
		time.Sleep(time.Millisecond * 50)
		atomic.AddInt64(&count, 1)
	})
	thread.Go(ctx, func(ctx context.Context) {
		time.Sleep(time.Millisecond * 50)
		atomic.AddInt64(&count, 1)
	})
	thread.Stop(true, time.Millisecond*60)
	if atomic.LoadInt64(&count) != 3 {
		t.Fail()
	}

	wait := sync.WaitGroup{}
	wait.Add(1)
	go func() {
		defer func() {
			if err := recover(); err != ErrStopped {
				// should panic
				t.Fail()
			}
			wait.Done()
		}()
		thread.Go(ctx, func(ctx context.Context) {
			time.Sleep(time.Millisecond * 50)
			atomic.AddInt64(&count, 1)
		})
		time.Sleep(time.Second * 60)
		if atomic.LoadInt64(&count) != 3 {
			t.Fail()
		}
	}()
	wait.Wait()

	thread = New()
	atomic.SwapInt64(&count, 0)
	thread.Go(ctx, func(ctx context.Context) {
		time.Sleep(time.Microsecond * 50)
		atomic.AddInt64(&count, 1)
	})
	thread.Stop(true, time.Microsecond*10)
	if atomic.LoadInt64(&count) != 0 {
		t.Fail()
	}

	// test panic
	thread = New()
	list := []int{}
	atomic.SwapInt64(&count, 0)
	wait.Add(1)
	thread.Go(ctx, func(ctx context.Context) {
		// should painc
		log.Println(list[3])
	}, func(ctx context.Context, err interface{}) {
		wait.Done()
		atomic.SwapInt64(&count, 1)
	})
	wait.Wait()
	if atomic.LoadInt64(&count) != 1 {
		t.Fail()
	}

}
