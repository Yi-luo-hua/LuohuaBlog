package main

import (
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"regexp"
	"strconv"
	"strings"
	"time"
)

const ownerMomentsDataPath = "main/src/data/moments.js"

var (
	ownerMomentYearPattern = regexp.MustCompile(`^\d{4}$`)
	ownerMomentDatePattern = regexp.MustCompile(`^\d{1,2}\.\d{1,2}$`)
)

type ownerMomentPublishRequest struct {
	Year     string `json:"year"`
	Date     string `json:"date"`
	Type     string `json:"type"`
	Category string `json:"category"`
	Content  string `json:"content"`
}

type ownerMomentPublishResult struct {
	Year          string
	Date          string
	Type          string
	Path          string
	CommitSHA     string
	Changed       bool
	CommitMessage string
}

func ownerMomentPublishHandler(w http.ResponseWriter, r *http.Request) {
	ownerSess, ok := requireOwnerSession(w, r)
	if !ok {
		return
	}

	var body ownerMomentPublishRequest
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeJSONStatus(w, http.StatusBadRequest, map[string]any{
			"error":   "INVALID_JSON",
			"message": "碎语发布请求格式不正确。",
		})
		return
	}

	publisher := newOwnerGitHubPublisher()
	if !publisher.configured() {
		recordSecurityAudit(r, "owner.moment_publish", "failure", ownerSess.UserID, "owner_publish", ownerMomentsDataPath, "not_configured")
		writeJSONStatus(w, http.StatusServiceUnavailable, map[string]any{
			"error":   "PUBLISH_NOT_CONFIGURED",
			"message": "站长发布尚未在服务器配置。",
		})
		return
	}

	result, err := publisher.publishMoment(body)
	if err != nil {
		var publishErr *ownerPublishError
		if ok := errorAs(err, &publishErr); ok {
			writeJSONStatus(w, http.StatusBadGateway, map[string]any{
				"error":   "MOMENT_PUBLISH_FAILED",
				"message": publishErr.Message,
			})
			recordSecurityAudit(r, "owner.moment_publish", "failure", ownerSess.UserID, "owner_publish", ownerMomentsDataPath, fmt.Sprintf("github_status=%d", publishErr.StatusCode))
			return
		}
		writeJSONStatus(w, http.StatusBadRequest, map[string]any{
			"error":   "INVALID_MOMENT_PUBLISH",
			"message": err.Error(),
		})
		recordSecurityAudit(r, "owner.moment_publish", "failure", ownerSess.UserID, "owner_publish", ownerMomentsDataPath, "invalid_request")
		return
	}

	recordSecurityAudit(r, "owner.moment_publish", "success", ownerSess.UserID, "owner_publish", result.Path, fmt.Sprintf("branch=%s changed=%t", publisher.branch, result.Changed))
	writeJSON(w, map[string]any{
		"ok": true,
		"item": map[string]any{
			"year":          result.Year,
			"date":          result.Date,
			"type":          result.Type,
			"path":          result.Path,
			"commitSha":     result.CommitSHA,
			"changed":       result.Changed,
			"branch":        publisher.branch,
			"commitMessage": result.CommitMessage,
			"repoURL": fmt.Sprintf(
				"https://github.com/%s/%s/blob/%s/%s",
				publisher.owner,
				publisher.repo,
				publisher.branch,
				result.Path,
			),
		},
		"owner": map[string]any{
			"email":       ownerSess.Email,
			"displayName": ownerSess.DisplayName,
		},
	})
}

func (p *ownerGitHubPublisher) publishMoment(req ownerMomentPublishRequest) (ownerMomentPublishResult, error) {
	file, err := p.getGitHubFile(ownerMomentsDataPath)
	if err != nil {
		return ownerMomentPublishResult{}, err
	}
	updated, result, err := buildOwnerMomentsDataUpdate(file.Content, req)
	if err != nil {
		return ownerMomentPublishResult{}, err
	}
	result.Path = ownerMomentsDataPath
	result.CommitMessage = ownerMomentPublishCommitMessage(result.Year, result.Date)
	if !result.Changed {
		return result, nil
	}
	putResult, err := p.putGitHubFile(ownerMomentsDataPath, result.CommitMessage, updated, file.SHA)
	if err != nil {
		return ownerMomentPublishResult{}, err
	}
	result.Path = putResult.Path
	result.CommitSHA = putResult.CommitSHA
	return result, nil
}

func buildOwnerMomentsDataUpdate(source string, req ownerMomentPublishRequest) (string, ownerMomentPublishResult, error) {
	year := strings.TrimSpace(req.Year)
	if year == "" {
		year = ownerMomentDefaultYear(time.Now())
	}
	if !ownerMomentYearPattern.MatchString(year) {
		return "", ownerMomentPublishResult{}, errors.New("碎语年份格式应为 2026 这样的四位年份")
	}

	date := strings.TrimSpace(req.Date)
	if date == "" {
		date = ownerMomentDefaultDate(time.Now())
	}
	if !ownerMomentDatePattern.MatchString(date) {
		return "", ownerMomentPublishResult{}, errors.New("碎语日期格式应为 6.8 这样的月.日")
	}

	momentType := strings.TrimSpace(req.Type)
	if momentType == "" {
		momentType = strings.TrimSpace(req.Category)
	}
	if momentType == "" {
		return "", ownerMomentPublishResult{}, errors.New("碎语分类不能为空")
	}

	lines := ownerMomentContentLines(req.Content)
	if len(lines) == 0 {
		return "", ownerMomentPublishResult{}, errors.New("碎语内容不能为空")
	}

	arrayOpen := strings.Index(source, "export const moments = [")
	if arrayOpen < 0 {
		return "", ownerMomentPublishResult{}, errors.New("未找到 moments 导出")
	}
	arrayOpen += strings.Index(source[arrayOpen:], "[")
	arrayClose, ok := findMatchingJS(source, arrayOpen, '[', ']')
	if !ok {
		return "", ownerMomentPublishResult{}, errors.New("moments 数组无效")
	}

	tone, module := ownerNextMomentStyle(source[arrayOpen:arrayClose])
	card := newMomentLiteral(year, date, momentType, tone, module, lines)
	insertAt := ownerMomentInsertIndex(source, arrayOpen, arrayClose, year, date)
	return source[:insertAt] + card + source[insertAt:], ownerMomentPublishResult{
		Year:    year,
		Date:    date,
		Type:    momentType,
		Changed: true,
	}, nil
}

func ownerMomentContentLines(content string) []string {
	normalized := strings.ReplaceAll(content, "\r\n", "\n")
	rawLines := strings.Split(normalized, "\n")
	lines := make([]string, 0, len(rawLines))
	for _, line := range rawLines {
		trimmed := strings.TrimSpace(line)
		if trimmed != "" {
			lines = append(lines, trimmed)
		}
	}
	return lines
}

func newMomentLiteral(year, date, momentType, tone, module string, lines []string) string {
	lineValues := make([]string, 0, len(lines))
	for _, line := range lines {
		lineValues = append(lineValues, jsStringLiteral(line))
	}
	return strings.Join([]string{
		"  {",
		"    year: " + jsStringLiteral(year) + ",",
		"    date: " + jsStringLiteral(date) + ",",
		"    type: " + jsStringLiteral(momentType) + ",",
		"    tone: " + jsStringLiteral(tone) + ",",
		"    module: " + jsStringLiteral(module) + ",",
		"    lines: [" + strings.Join(lineValues, ", ") + "],",
		"  },",
	}, "\n") + "\n"
}

func ownerMomentInsertIndex(source string, arrayOpen, arrayClose int, year, date string) int {
	newOrder := ownerMomentDateOrder(year, date)
	pos := arrayOpen + 1
	for {
		idx := strings.Index(source[pos:arrayClose], "date:")
		if idx < 0 {
			break
		}
		dateIndex := pos + idx
		existingDate := ownerMomentDateAt(source[dateIndex:arrayClose])
		existingYear := ownerMomentYearBeforeDate(source[:dateIndex])
		if existingDate != "" && newOrder >= ownerMomentDateOrder(existingYear, existingDate) {
			objectStart := strings.LastIndex(source[:dateIndex], "\n  {")
			if objectStart >= 0 {
				return objectStart + 1
			}
		}
		pos = dateIndex + len("date:")
	}
	return strings.LastIndex(source[:arrayClose], "\n") + 1
}

func ownerMomentDateAt(source string) string {
	firstQuote := strings.Index(source, `"`)
	if firstQuote < 0 {
		return ""
	}
	secondQuote := strings.Index(source[firstQuote+1:], `"`)
	if secondQuote < 0 {
		return ""
	}
	return source[firstQuote+1 : firstQuote+1+secondQuote]
}

func ownerMomentYearBeforeDate(source string) string {
	objectStart := strings.LastIndex(source, "\n  {")
	if objectStart < 0 {
		return ""
	}
	yearIndex := strings.LastIndex(source[objectStart:], "year:")
	if yearIndex < 0 {
		return ""
	}
	return ownerMomentDateAt(source[objectStart+yearIndex:])
}

func ownerMomentDateOrder(year, date string) int {
	parts := strings.Split(date, ".")
	if len(parts) != 2 {
		return 0
	}
	yearNumber, _ := strconv.Atoi(year)
	month, _ := strconv.Atoi(parts[0])
	day, _ := strconv.Atoi(parts[1])
	return yearNumber*10000 + month*100 + day
}

func ownerNextMomentStyle(source string) (string, string) {
	tones := []string{"aurora", "ticket", "watercolor", "mist", "journal", "mint"}
	modules := []string{"postcard", "ticket", "watercolor", "poem", "journal", "ribbon"}
	count := strings.Count(source, "date:")
	return tones[count%len(tones)], modules[count%len(modules)]
}

func ownerMomentDefaultDate(now time.Time) string {
	siteNow := now.UTC().Add(8 * time.Hour)
	return fmt.Sprintf("%d.%d", int(siteNow.Month()), siteNow.Day())
}

func ownerMomentDefaultYear(now time.Time) string {
	siteNow := now.UTC().Add(8 * time.Hour)
	return strconv.Itoa(siteNow.Year())
}

func ownerMomentPublishCommitMessage(year, date string) string {
	return "feat: publish moment " + year + "-" + date + " " + time.Now().UTC().Format("20060102-150405")
}
