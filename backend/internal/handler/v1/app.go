package v1

import (
	"erp/internal/pkg/response"
	"erp/internal/service"
	"github.com/gin-gonic/gin"
)

// AppHandler 应用级 HTTP 处理器。
type AppHandler struct {
	appService service.AppService
}

func NewAppHandler(appService service.AppService) *AppHandler {
	return &AppHandler{appService: appService}
}

// Init 应用启动初始化（科目同步、凭证校正、已申报季度结项同步）。
func (h *AppHandler) Init(c *gin.Context) {
	result, err := h.appService.Init(c.Request.Context())
	if err != nil {
		response.InternalError(c, err.Error())
		return
	}
	response.Success(c, result)
}
