# Site media

Everything Nginx serves under `/cos/`.

The name is historical: these files used to be reverse-proxied from a Tencent
COS bucket that belonged to the author of the template this site started from,
so every image and video here depended on a stranger's storage staying up and
was billed to their traffic. They were moved onto this site's own server on
2026-08-25 and committed here so a rebuilt server can restore them from a
checkout instead of from an account nobody here controls.

`deploy/deploy-azure.sh cos` uploads this directory to `/var/www/luohua/cos/`.
The frontend never references these paths directly — it only ever builds
`/cos/...` URLs through `main/src/lib/cosAsset.js`.
