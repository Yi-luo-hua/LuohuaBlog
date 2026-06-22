package main

import (
	"net/http"
	"os"
	"runtime"
	"strconv"
	"strings"
	"time"
)

// serverStartedAt 记录进程启动时间，用于计算运行时长
var serverStartedAt = time.Now()

// serverInfoHandler 返回非敏感的服务器信息
// 故意不返回：真实 IP、主机名、域名、磁盘路径、进程列表、环境变量等敏感信息
func serverInfoHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}

	mem := readMemoryUsage()
	cpu := readCPUUsage()

	info := map[string]any{
		"vendor":      env("SERVER_VENDOR", "UCloud 香港"),
		"region":      env("SERVER_REGION", "亚太 · 香港"),
		"os":          osFriendlyName(),
		"arch":        runtime.GOARCH,
		"goVersion":   runtime.Version(),
		"cpuCores":    runtime.NumCPU(),
		"goroutines":  runtime.NumGoroutine(),
		"memory":      mem,
		"cpuPercent":  cpu,
		"uptime":      formatUptime(time.Since(serverStartedAt)),
		"uptimeSecs":  int64(time.Since(serverStartedAt).Seconds()),
		"status":      "online",
		"serverTime":  time.Now().UTC().Format(time.RFC3339),
	}
	writeJSON(w, info)
}

// memoryUsage 内存使用情况
type memoryUsage struct {
	UsedMB    int64   `json:"usedMB"`
	TotalMB   int64   `json:"totalMB"`
	UsedRatio float64 `json:"usedRatio"`
	Source    string  `json:"source"` // "system" 或 "process"
}

// readMemoryUsage 优先读取系统级内存（/proc/meminfo），否则降级到 Go 进程内存
func readMemoryUsage() memoryUsage {
	if usage, ok := readLinuxMemoryUsage(); ok {
		return usage
	}
	// Windows / macOS 开发环境降级：只能读 Go 进程内存
	var ms runtime.MemStats
	runtime.ReadMemStats(&ms)
	used := int64(ms.Sys / 1024 / 1024)
	// 没有真实"总内存"，给一个估算上限避免 100% 显示
	total := used * 4
	if total < 256 {
		total = 256
	}
	return memoryUsage{
		UsedMB:    used,
		TotalMB:   total,
		UsedRatio: float64(used) / float64(total),
		Source:    "process",
	}
}

// readLinuxMemoryUsage 通过 /proc/meminfo 读取系统内存
func readLinuxMemoryUsage() (memoryUsage, bool) {
	data, err := os.ReadFile("/proc/meminfo")
	if err != nil {
		return memoryUsage{}, false
	}
	values := map[string]int64{}
	for _, line := range strings.Split(string(data), "\n") {
		parts := strings.SplitN(line, ":", 2)
		if len(parts) != 2 {
			continue
		}
		key := strings.TrimSpace(parts[0])
		valStr := strings.TrimSpace(parts[1])
		valStr = strings.TrimSuffix(valStr, " kB")
		if v, err := strconv.ParseInt(strings.TrimSpace(valStr), 10, 64); err == nil {
			values[key] = v // KB
		}
	}
	total := values["MemTotal"]
	if total <= 0 {
		return memoryUsage{}, false
	}
	// available 比 free 更能反映"可用"
	available := values["MemAvailable"]
	if available <= 0 {
		available = values["MemFree"] + values["Buffers"] + values["Cached"]
	}
	used := total - available
	if used < 0 {
		used = 0
	}
	return memoryUsage{
		UsedMB:    used / 1024,
		TotalMB:   total / 1024,
		UsedRatio: float64(used) / float64(total),
		Source:    "system",
	}, true
}

// cpuSnap CPU 采样快照（用于计算两次之间的占用率）
type cpuSnap struct {
	idle  uint64
	total uint64
}

var lastCPUSnap cpuSnap

// readCPUUsage 计算 CPU 占用百分比（0-100）
func readCPUUsage() float64 {
	if pct, ok := readLinuxCPUUsage(); ok {
		return pct
	}
	// Windows / macOS 开发环境：根据 goroutine 数粗略估算，仅供前端显示用
	g := float64(runtime.NumGoroutine())
	pct := g / 200.0 * 100
	if pct > 100 {
		pct = 100
	}
	return roundTo(pct, 1)
}

// readLinuxCPUUsage 读取 /proc/stat 第一行（cpu 汇总），两次采样间隔短时差作为占用率
func readLinuxCPUUsage() (float64, bool) {
	snap, ok := sampleCPUStat()
	if !ok {
		return 0, false
	}
	// 等待一小段时间再采一次（200ms 足够稳定且不影响响应速度）
	time.Sleep(200 * time.Millisecond)
	snap2, ok := sampleCPUStat()
	if !ok {
		return 0, false
	}
	idleDelta := float64(snap2.idle - snap.idle)
	totalDelta := float64(snap2.total - snap.total)
	if totalDelta <= 0 {
		return 0, true
	}
	pct := (1 - idleDelta/totalDelta) * 100
	if pct < 0 {
		pct = 0
	}
	if pct > 100 {
		pct = 100
	}
	lastCPUSnap = snap2
	return roundTo(pct, 1), true
}

func sampleCPUStat() (cpuSnap, bool) {
	data, err := os.ReadFile("/proc/stat")
	if err != nil {
		return cpuSnap{}, false
	}
	lines := strings.Split(string(data), "\n")
	if len(lines) == 0 {
		return cpuSnap{}, false
	}
	fields := strings.Fields(lines[0])
	if len(fields) < 5 || fields[0] != "cpu" {
		return cpuSnap{}, false
	}
	var snap cpuSnap
	for i := 1; i < len(fields); i++ {
		v, err := strconv.ParseUint(fields[i], 10, 64)
		if err != nil {
			continue
		}
		snap.total += v
		// 第 4 个字段是 idle，第 5 个是 iowait
		if i == 4 || i == 5 {
			snap.idle += v
		}
	}
	return snap, true
}

// osFriendlyName 友好的操作系统名（不暴露具体发行版/内核版本）
func osFriendlyName() string {
	switch runtime.GOOS {
	case "linux":
		return "Linux"
	case "darwin":
		return "macOS"
	case "windows":
		return "Windows"
	default:
		return strings.ToUpper(runtime.GOOS[:1]) + runtime.GOOS[1:]
	}
}

// formatUptime 人性化运行时长
func formatUptime(d time.Duration) string {
	if d < time.Minute {
		return strconv.Itoa(int(d.Seconds())) + " 秒"
	}
	if d < time.Hour {
		return strconv.Itoa(int(d.Minutes())) + " 分钟"
	}
	if d < 24*time.Hour {
		h := int(d.Hours())
		m := int(d.Minutes()) % 60
		return strconv.Itoa(h) + " 小时 " + strconv.Itoa(m) + " 分"
	}
	days := int(d.Hours()) / 24
	hours := int(d.Hours()) % 24
	if hours == 0 {
		return strconv.Itoa(days) + " 天"
	}
	return strconv.Itoa(days) + " 天 " + strconv.Itoa(hours) + " 小时"
}

// roundTo 保留 n 位小数
func roundTo(v float64, n int) float64 {
	shift := 1.0
	for i := 0; i < n; i++ {
		shift *= 10
	}
	return float64(int64(v*shift+0.5)) / shift
}
