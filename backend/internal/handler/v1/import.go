package v1

import (
	"encoding/base64"
	"io"
	"net/http"
	"strings"

	"erp/internal/pkg/llm"
	"erp/internal/pkg/response"
	"github.com/gin-gonic/gin"
)

// ImportHandler 历史凭证导入辅助（图片大模型识别等）。
type ImportHandler struct {
	llm *llm.Client
}

func NewImportHandler(client *llm.Client) *ImportHandler {
	return &ImportHandler{llm: client}
}

type parseImportImageJSONRequest struct {
	ImageBase64 string `json:"imageBase64"`
	MimeType    string `json:"mimeType"`
}

// ParseImportImage POST /vouchers/parse-import-image
// 支持 multipart file，或 JSON { imageBase64, mimeType }。
func (h *ImportHandler) ParseImportImage(c *gin.Context) {
	if !requireAdmin(c) {
		return
	}
	if h.llm == nil || !h.llm.Enabled() {
		response.Fail(c, http.StatusServiceUnavailable, 503, "未配置大模型（APP_LLM_API_KEY），无法识别截图")
		return
	}

	mimeType := ""
	var raw []byte

	if strings.HasPrefix(c.GetHeader("Content-Type"), "multipart/form-data") {
		file, err := c.FormFile("file")
		if err != nil {
			response.Fail(c, http.StatusBadRequest, 400, "请上传图片文件（字段名 file）")
			return
		}
		f, err := file.Open()
		if err != nil {
			response.Fail(c, http.StatusBadRequest, 400, "读取上传文件失败")
			return
		}
		defer f.Close()
		raw, err = io.ReadAll(io.LimitReader(f, 12<<20)) // 12MB
		if err != nil {
			response.Fail(c, http.StatusBadRequest, 400, "读取上传文件失败")
			return
		}
		mimeType = file.Header.Get("Content-Type")
		if mimeType == "" {
			mimeType = http.DetectContentType(raw)
		}
	} else {
		var req parseImportImageJSONRequest
		if err := c.ShouldBindJSON(&req); err != nil {
			response.Fail(c, http.StatusBadRequest, 400, "请求体无效，需 multipart file 或 JSON imageBase64")
			return
		}
		b64 := strings.TrimSpace(req.ImageBase64)
		if i := strings.Index(b64, ","); i >= 0 && strings.Contains(b64[:i], "base64") {
			b64 = b64[i+1:]
		}
		decoded, err := base64.StdEncoding.DecodeString(b64)
		if err != nil {
			response.Fail(c, http.StatusBadRequest, 400, "imageBase64 解码失败")
			return
		}
		raw = decoded
		mimeType = strings.TrimSpace(req.MimeType)
		if mimeType == "" {
			mimeType = http.DetectContentType(raw)
		}
	}

	if len(raw) == 0 {
		response.Fail(c, http.StatusBadRequest, 400, "图片内容为空")
		return
	}
	if !strings.HasPrefix(mimeType, "image/") {
		mimeType = "image/png"
	}

	encoded := base64.StdEncoding.EncodeToString(raw)
	rows, err := h.llm.ExtractTableRows(c.Request.Context(), mimeType, encoded)
	if err != nil {
		response.Fail(c, http.StatusBadGateway, 502, err.Error())
		return
	}
	if len(rows) == 0 {
		response.Fail(c, http.StatusUnprocessableEntity, 422, "未能从图片识别出表格，请换更清晰的分录表截图或改用 Excel")
		return
	}

	response.Success(c, gin.H{
		"rows":   rows,
		"engine": "llm",
		"model":  h.llm.VisionModel(),
	})
}

// LLMStatus GET /vouchers/import-llm-status
func (h *ImportHandler) LLMStatus(c *gin.Context) {
	enabled := h.llm != nil && h.llm.Enabled()
	model := ""
	if enabled {
		model = h.llm.VisionModel()
	}
	response.Success(c, gin.H{
		"enabled": enabled,
		"model":   model,
	})
}
