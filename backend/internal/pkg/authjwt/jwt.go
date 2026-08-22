// Package authjwt 提供登录 JWT 签发与校验。
package authjwt

import (
	"errors"
	"fmt"
	"time"

	"erp/internal/pkg/rbac"
	"github.com/golang-jwt/jwt/v5"
)

var (
	ErrInvalidToken = errors.New("无效的登录凭证")
	ErrExpiredToken = errors.New("登录已过期，请重新登录")
)

type Claims struct {
	AccountID          uint   `json:"account_id"`
	Username           string `json:"username"`
	Nickname           string `json:"nickname"`
	Role               string `json:"role"`
	MustChangePassword bool   `json:"must_change_password"`
	jwt.RegisteredClaims
}

type Manager struct {
	secret []byte
	expire time.Duration
}

func NewManager(secret string, expireHours int) *Manager {
	if secret == "" {
		secret = "erp-dev-jwt-secret-change-me"
	}
	if expireHours <= 0 {
		expireHours = 72
	}
	return &Manager{
		secret: []byte(secret),
		expire: time.Duration(expireHours) * time.Hour,
	}
}

func (m *Manager) Sign(accountID uint, username, nickname, role string, mustChangePassword bool) (string, time.Time, error) {
	expiresAt := time.Now().Add(m.expire)
	claims := Claims{
		AccountID:          accountID,
		Username:           username,
		Nickname:           nickname,
		Role:               rbac.NormalizeRole(role),
		MustChangePassword: mustChangePassword,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(expiresAt),
			IssuedAt:  jwt.NewNumericDate(time.Now()),
			Subject:   fmt.Sprintf("%d", accountID),
		},
	}
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	signed, err := token.SignedString(m.secret)
	if err != nil {
		return "", time.Time{}, err
	}
	return signed, expiresAt, nil
}

func (m *Manager) Parse(tokenString string) (*Claims, error) {
	token, err := jwt.ParseWithClaims(tokenString, &Claims{}, func(t *jwt.Token) (interface{}, error) {
		if t.Method != jwt.SigningMethodHS256 {
			return nil, fmt.Errorf("unexpected signing method: %v", t.Header["alg"])
		}
		return m.secret, nil
	})
	if err != nil {
		if errors.Is(err, jwt.ErrTokenExpired) {
			return nil, ErrExpiredToken
		}
		return nil, ErrInvalidToken
	}
	claims, ok := token.Claims.(*Claims)
	if !ok || !token.Valid {
		return nil, ErrInvalidToken
	}
	claims.Role = rbac.NormalizeRole(claims.Role)
	return claims, nil
}

// ToActor 将声明转为 rbac.Actor。
func (c *Claims) ToActor() *rbac.Actor {
	if c == nil {
		return nil
	}
	return &rbac.Actor{
		AccountID: c.AccountID,
		Username:  c.Username,
		Nickname:  c.Nickname,
		Role:      rbac.NormalizeRole(c.Role),
	}
}
