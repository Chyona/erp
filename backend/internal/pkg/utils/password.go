package utils

import (
	"crypto/sha256"
	"crypto/subtle"
	"encoding/hex"
	"errors"
	"strings"

	"golang.org/x/crypto/bcrypt"
)

const (
	bcryptCost     = 12
	MinPasswordLen = 8
)

var ErrWeakPassword = errors.New("密码至少 8 位")

// ValidatePasswordPolicy 校验新密码强度。
func ValidatePasswordPolicy(password string) error {
	if len(password) < MinPasswordLen {
		return ErrWeakPassword
	}
	return nil
}

// HashPassword 使用 bcrypt 哈希新密码。
func HashPassword(password string) (string, error) {
	if err := ValidatePasswordPolicy(password); err != nil {
		return "", err
	}
	hash, err := bcrypt.GenerateFromPassword([]byte(password), bcryptCost)
	if err != nil {
		return "", err
	}
	return string(hash), nil
}

// RehashPassword 登录时将旧 SHA256 密码升级为 bcrypt（不重复校验长度策略）。
func RehashPassword(password string) (string, error) {
	hash, err := bcrypt.GenerateFromPassword([]byte(password), bcryptCost)
	if err != nil {
		return "", err
	}
	return string(hash), nil
}

// IsBcryptHash 判断是否为 bcrypt 哈希。
func IsBcryptHash(hashed string) bool {
	return strings.HasPrefix(hashed, "$2a$") ||
		strings.HasPrefix(hashed, "$2b$") ||
		strings.HasPrefix(hashed, "$2y$")
}

func hashPasswordLegacy(password string) string {
	sum := sha256.Sum256([]byte(password))
	return hex.EncodeToString(sum[:])
}

// CheckPassword 校验密码；第二返回值表示是否需要升级为 bcrypt。
func CheckPassword(password, hashed string) (bool, bool) {
	if IsBcryptHash(hashed) {
		err := bcrypt.CompareHashAndPassword([]byte(hashed), []byte(password))
		return err == nil, false
	}
	legacy := hashPasswordLegacy(password)
	ok := subtle.ConstantTimeCompare([]byte(legacy), []byte(hashed)) == 1
	return ok, ok
}
