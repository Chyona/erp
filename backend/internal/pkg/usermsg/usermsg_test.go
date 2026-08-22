package usermsg_test

import (
	"testing"

	"erp/internal/pkg/usermsg"
)

func TestSanitizeDuplicateEmail(t *testing.T) {
	in := `ERROR: duplicate key value violates unique constraint "idx_account_email" (SQLSTATE 23505)`
	got := usermsg.Sanitize(in)
	want := "该邮箱已被使用，请换一个邮箱"
	if got != want {
		t.Fatalf("got %q want %q", got, want)
	}
}

func TestSanitizeKeepsChinese(t *testing.T) {
	in := "用户名或密码错误"
	if got := usermsg.Sanitize(in); got != in {
		t.Fatalf("got %q want %q", got, in)
	}
}

func TestSanitizeGinEmail(t *testing.T) {
	in := `Key: 'CreateAccountRequest.Email' Error:Field validation for 'Email' failed on the 'email' tag`
	got := usermsg.Sanitize(in)
	want := "邮箱格式不正确"
	if got != want {
		t.Fatalf("got %q want %q", got, want)
	}
}
