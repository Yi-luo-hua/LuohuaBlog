package main

import (
	"crypto/md5"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"path"
	"sort"
	"strings"
	"time"
)

// WBI signing (Bilibili web API).
var mixinKeyEncTab = []int{
	46, 47, 18, 2, 53, 8, 23, 32, 15, 50, 10, 31, 58, 3, 45, 35, 27, 43, 5, 49,
	33, 9, 42, 19, 29, 6, 54, 38, 51, 15, 36, 13, 60, 52, 26, 4, 57, 48, 55, 37,
	12, 44, 28, 41, 1, 21, 56, 39, 59, 20, 17, 25, 61, 40, 34, 11, 16, 24, 7, 30,
	22, 14, 62, 9, 63, 47, 51, 35,
}

type wbiKeys struct {
	img string
	sub string
	at  time.Time
}

var cachedWBI wbiKeys

func getWBIKeys(client *http.Client) (img, sub string, err error) {
	if cachedWBI.img != "" && time.Since(cachedWBI.at) < 12*time.Hour {
		return cachedWBI.img, cachedWBI.sub, nil
	}
	req, _ := http.NewRequest(http.MethodGet, "https://api.bilibili.com/x/web-interface/nav", nil)
	req.Header.Set("User-Agent", biliUA)
	req.Header.Set("Referer", "https://www.bilibili.com")
	res, err := client.Do(req)
	if err != nil {
		return "", "", err
	}
	defer res.Body.Close()
	body, _ := io.ReadAll(res.Body)
	var payload struct {
		Code int `json:"code"`
		Data struct {
			WBI struct {
				ImgURL string `json:"img_url"`
				SubURL string `json:"sub_url"`
			} `json:"wbi_img"`
		} `json:"data"`
	}
	if err := json.Unmarshal(body, &payload); err != nil {
		return "", "", err
	}
	if payload.Code != 0 {
		return "", "", fmt.Errorf("nav wbi code=%d", payload.Code)
	}
	img = extractWBIKey(payload.Data.WBI.ImgURL)
	sub = extractWBIKey(payload.Data.WBI.SubURL)
	cachedWBI = wbiKeys{img: img, sub: sub, at: time.Now()}
	return img, sub, nil
}

func extractWBIKey(rawURL string) string {
	u := strings.TrimPrefix(rawURL, "//")
	base := path.Base(strings.Split(u, "?")[0])
	return strings.TrimSuffix(base, ".png")
}

func mixinKey(orig string) string {
	var b strings.Builder
	for _, i := range mixinKeyEncTab {
		if i >= 0 && i < len(orig) {
			b.WriteByte(orig[i])
		}
	}
	return b.String()[:32]
}

func signWBI(params map[string]string, img, sub string) map[string]string {
	mk := mixinKey(img + sub)
	out := make(map[string]string, len(params)+2)
	for k, v := range params {
		out[k] = sanitizeWBIValue(v)
	}
	out["wts"] = fmt.Sprintf("%d", time.Now().Unix())
	keys := make([]string, 0, len(out))
	for k := range out {
		keys = append(keys, k)
	}
	sort.Strings(keys)
	var qs strings.Builder
	for i, k := range keys {
		if i > 0 {
			qs.WriteByte('&')
		}
		qs.WriteString(url.QueryEscape(k))
		qs.WriteByte('=')
		qs.WriteString(url.QueryEscape(out[k]))
	}
	sum := md5.Sum([]byte(qs.String() + mk))
	out["w_rid"] = hex.EncodeToString(sum[:])
	return out
}

func sanitizeWBIValue(v string) string {
	var b strings.Builder
	for _, r := range v {
		if strings.ContainsRune("!'()*", r) {
			continue
		}
		b.WriteRune(r)
	}
	return b.String()
}
