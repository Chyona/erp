package rbac

import "context"

type actorCtxKey struct{}

// WithActor 将 Actor 写入 context。
func WithActor(ctx context.Context, actor *Actor) context.Context {
	if actor == nil {
		return ctx
	}
	return context.WithValue(ctx, actorCtxKey{}, actor)
}

// ActorFrom 从 context 读取 Actor。
func ActorFrom(ctx context.Context) *Actor {
	if ctx == nil {
		return nil
	}
	if v, ok := ctx.Value(actorCtxKey{}).(*Actor); ok {
		return v
	}
	return nil
}
