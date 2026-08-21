package llm

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"

	"erp/internal/config"
)

const defaultBaseURL = "https://dashscope.aliyuncs.com/compatible-mode/v1"
const defaultVisionModel = "qwen-vl-max"

// Client OpenAI 兼容 Chat Completions 客户端（DashScope 等）。
type Client struct {
	apiKey      string
	baseURL     string
	model       string
	visionModel string
	flashModel  string
	httpClient  *http.Client
}

func NewClient(cfg config.LLMConfig) *Client {
	base := strings.TrimRight(strings.TrimSpace(cfg.BaseURL), "/")
	if base == "" {
		base = defaultBaseURL
	}
	vision := strings.TrimSpace(cfg.VisionModel)
	if vision == "" {
		vision = defaultVisionModel
	}
	model := strings.TrimSpace(cfg.Model)
	if model == "" {
		model = "qwen3.7-plus"
	}
	return &Client{
		apiKey:      strings.TrimSpace(cfg.APIKey),
		baseURL:     base,
		model:       model,
		visionModel: vision,
		flashModel:  strings.TrimSpace(cfg.FlashModel),
		httpClient:  &http.Client{Timeout: 120 * time.Second},
	}
}

func (c *Client) Enabled() bool {
	return c != nil && c.apiKey != ""
}

func (c *Client) VisionModel() string {
	if c == nil {
		return defaultVisionModel
	}
	return c.visionModel
}

type chatMessage struct {
	Role    string `json:"role"`
	Content any    `json:"content"`
}

type chatRequest struct {
	Model    string        `json:"model"`
	Messages []chatMessage `json:"messages"`
}

type chatResponse struct {
	Choices []struct {
		Message struct {
			Content string `json:"content"`
		} `json:"message"`
	} `json:"choices"`
	Error *struct {
		Message string `json:"message"`
		Type    string `json:"type"`
		Code    string `json:"code"`
	} `json:"error"`
}

const tableExtractPrompt = `你是会计凭证表格识别助手。请从图片中的「分录表」提取表格数据。

要求：
1. 只输出一个 JSON 二维数组（数组的数组），不要 Markdown、不要解释。
2. 第一行必须是表头，尽量使用这些列名（有则保留）：凭证号、凭证日期、季度、摘要、一级科目、二级科目、借方金额、贷方金额、往来单位、附件数、备注。
3. 后续每一行是一条分录；同一凭证号可多行。
4. 金额规则（非常重要）：
   - 借方金额、贷方金额是两列，必须严格按图片中该格所在列填写，禁止把借方数字写到贷方，也禁止把贷方数字写到借方。
   - 某一行若金额在「借方」列，则「借方金额」填数字、「贷方金额」填 ""；若在「贷方」列，则相反。
   - 同一行通常只有一侧有金额；两侧都空或两侧都有数字都属异常，仍按图片如实填写。
   - 金额只保留数字和小数点（去掉千分位逗号）；空单元格用 ""。
5. 科目、摘要、往来单位等文字也按所在列原样抄录，不要根据会计常识改写或对调借贷。
6. 若图片不是分录表或无法识别，输出 []。

示例（缴纳公积金：两行借方 + 一行贷方）：
[["凭证号","凭证日期","摘要","一级科目","二级科目","借方金额","贷方金额","往来单位","备注"],["记-022","2026/8/21","缴纳 2026 年 08 月公积金","主营业务成本","","3840.00","","",""],["记-022","2026/8/21","缴纳 2026 年 08 月公积金","其他应付款","","3840.00","","",""],["记-022","2026/8/21","缴纳 2026 年 08 月公积金","银行存款","公账","","7680.00","",""]]`

// ExtractTableRows 用视觉模型从图片提取表格行。
func (c *Client) ExtractTableRows(ctx context.Context, mimeType, base64Data string) ([][]string, error) {
	if !c.Enabled() {
		return nil, fmt.Errorf("未配置 APP_LLM_API_KEY，无法使用大模型识别")
	}
	if base64Data == "" {
		return nil, fmt.Errorf("图片内容为空")
	}
	if mimeType == "" {
		mimeType = "image/png"
	}
	dataURL := fmt.Sprintf("data:%s;base64,%s", mimeType, base64Data)

	payload := chatRequest{
		Model: c.visionModel,
		Messages: []chatMessage{{
			Role: "user",
			Content: []map[string]any{
				{
					"type": "image_url",
					"image_url": map[string]string{
						"url": dataURL,
					},
				},
				{
					"type": "text",
					"text": tableExtractPrompt,
				},
			},
		}},
	}

	body, err := json.Marshal(payload)
	if err != nil {
		return nil, err
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, c.baseURL+"/chat/completions", bytes.NewReader(body))
	if err != nil {
		return nil, err
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+c.apiKey)

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("调用大模型失败: %w", err)
	}
	defer resp.Body.Close()

	raw, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}

	var parsed chatResponse
	if err := json.Unmarshal(raw, &parsed); err != nil {
		return nil, fmt.Errorf("解析大模型响应失败: %w", err)
	}
	if parsed.Error != nil && parsed.Error.Message != "" {
		return nil, fmt.Errorf("大模型错误: %s", parsed.Error.Message)
	}
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return nil, fmt.Errorf("大模型 HTTP %d: %s", resp.StatusCode, truncate(string(raw), 300))
	}
	if len(parsed.Choices) == 0 {
		return nil, fmt.Errorf("大模型未返回内容")
	}

	content := strings.TrimSpace(parsed.Choices[0].Message.Content)
	rows, err := parseJSONTable(content)
	if err != nil {
		return nil, err
	}
	return rows, nil
}

func parseJSONTable(content string) ([][]string, error) {
	text := strings.TrimSpace(content)
	text = strings.TrimPrefix(text, "```json")
	text = strings.TrimPrefix(text, "```JSON")
	text = strings.TrimPrefix(text, "```")
	text = strings.TrimSuffix(text, "```")
	text = strings.TrimSpace(text)

	start := strings.Index(text, "[")
	end := strings.LastIndex(text, "]")
	if start < 0 || end <= start {
		return nil, fmt.Errorf("大模型未返回表格 JSON")
	}
	text = text[start : end+1]

	var raw [][]any
	if err := json.Unmarshal([]byte(text), &raw); err != nil {
		return nil, fmt.Errorf("解析表格 JSON 失败: %w", err)
	}

	rows := make([][]string, 0, len(raw))
	for _, row := range raw {
		cells := make([]string, 0, len(row))
		for _, cell := range row {
			cells = append(cells, stringifyCell(cell))
		}
		rows = append(rows, cells)
	}
	return rows, nil
}

func stringifyCell(v any) string {
	switch t := v.(type) {
	case nil:
		return ""
	case string:
		return strings.TrimSpace(t)
	case float64:
		if t == float64(int64(t)) {
			return fmt.Sprintf("%.0f", t)
		}
		return strings.TrimRight(strings.TrimRight(fmt.Sprintf("%.4f", t), "0"), ".")
	case bool:
		if t {
			return "true"
		}
		return "false"
	default:
		b, err := json.Marshal(t)
		if err != nil {
			return fmt.Sprint(t)
		}
		return string(b)
	}
}

func truncate(s string, n int) string {
	if len(s) <= n {
		return s
	}
	return s[:n] + "..."
}
