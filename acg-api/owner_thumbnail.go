package main

import (
	"bytes"
	"errors"
	"image"
	"image/draw"
	"image/jpeg"
	"math"
	"path"
	"strings"

	_ "image/gif"
	_ "image/png"
)

// 相册列表按等高行排版，一行最高 300px，2x 屏也就 600px。长边压到 900 留足余量，
// 同时能把一张 4000px 的原图从几 MB 降到几十 KB——详情页仍然给原图。
const ownerThumbnailMaxEdge = 900

const ownerThumbnailQuality = 82

// 解码后的像素上限。8 MiB 的 JPEG 能解出很大的画面，先挡住再说，
// 免得一次上传就吃掉几百 MB 内存。
const ownerThumbnailMaxPixels = 50 * 1000 * 1000

// 原图已经够小，没必要再存一份。
var errThumbnailNotWorthIt = errors.New("image is already small enough")

// 生成缩略图。stdlib 没有 webp 解码器，webp 会在这里解码失败——
// 调用方把任何错误都当成“这张没有缩略图”处理，不影响发布。
func buildOwnerThumbnail(body []byte) ([]byte, int, int, error) {
	src, _, err := image.Decode(bytes.NewReader(body))
	if err != nil {
		return nil, 0, 0, err
	}

	bounds := src.Bounds()
	srcW, srcH := bounds.Dx(), bounds.Dy()
	if srcW <= 0 || srcH <= 0 {
		return nil, 0, 0, errors.New("image has no pixels")
	}
	if srcW*srcH > ownerThumbnailMaxPixels {
		return nil, 0, 0, errors.New("image is too large to thumbnail")
	}
	if srcW <= ownerThumbnailMaxEdge && srcH <= ownerThumbnailMaxEdge {
		return nil, 0, 0, errThumbnailNotWorthIt
	}

	scale := float64(ownerThumbnailMaxEdge) / float64(max(srcW, srcH))
	dstW := max(1, int(math.Round(float64(srcW)*scale)))
	dstH := max(1, int(math.Round(float64(srcH)*scale)))

	thumb := downscaleByArea(src, dstW, dstH)

	var out bytes.Buffer
	if err := jpeg.Encode(&out, thumb, &jpeg.Options{Quality: ownerThumbnailQuality}); err != nil {
		return nil, 0, 0, err
	}
	return out.Bytes(), dstW, dstH, nil
}

// 面积平均缩放：每个目标像素取它覆盖的那块源像素的平均值。缩小场景下这就是
// 常说的 area 重采样，比最近邻干净得多，也不用引入 x/image。
func downscaleByArea(src image.Image, dstW, dstH int) *image.RGBA {
	bounds := src.Bounds()
	// 先统一转成 RGBA 一次，后面直接读像素缓冲；逐点走 At() 在几百万像素上太慢。
	flat := image.NewRGBA(image.Rect(0, 0, bounds.Dx(), bounds.Dy()))
	draw.Draw(flat, flat.Bounds(), src, bounds.Min, draw.Src)

	srcW, srcH := flat.Bounds().Dx(), flat.Bounds().Dy()
	dst := image.NewRGBA(image.Rect(0, 0, dstW, dstH))

	for y := 0; y < dstH; y++ {
		y0 := y * srcH / dstH
		y1 := max(y0+1, (y+1)*srcH/dstH)

		for x := 0; x < dstW; x++ {
			x0 := x * srcW / dstW
			x1 := max(x0+1, (x+1)*srcW/dstW)

			var r, g, b, a, n uint64
			for sy := y0; sy < y1; sy++ {
				row := sy * flat.Stride
				for sx := x0; sx < x1; sx++ {
					i := row + sx*4
					r += uint64(flat.Pix[i])
					g += uint64(flat.Pix[i+1])
					b += uint64(flat.Pix[i+2])
					a += uint64(flat.Pix[i+3])
					n++
				}
			}

			o := dst.PixOffset(x, y)
			dst.Pix[o] = uint8(r / n)
			dst.Pix[o+1] = uint8(g / n)
			dst.Pix[o+2] = uint8(b / n)
			dst.Pix[o+3] = uint8(a / n)
		}
	}

	return dst
}

// 缩略图对象键：原图 gallery/2026/08/x.jpg -> gallery/2026/08/x-thumb.jpg
func ownerThumbnailObjectKey(objectKey string) string {
	ext := path.Ext(objectKey)
	return strings.TrimSuffix(objectKey, ext) + "-thumb.jpg"
}
