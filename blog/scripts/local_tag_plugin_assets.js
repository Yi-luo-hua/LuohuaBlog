'use strict'

const fs = require('fs')
const path = require('path')

const pluginRoot = path.join(hexo.base_dir, 'node_modules', 'hexo-butterfly-tag-plugins-plus')
const assets = [
  {
    from: path.join(pluginRoot, 'lib', 'assets', 'font-awesome-animation.min.css'),
    to: path.join(hexo.public_dir, 'css', 'vendor', 'font-awesome-animation.min.css')
  },
  {
    from: path.join(pluginRoot, 'lib', 'tag_plugins.css'),
    to: path.join(hexo.public_dir, 'css', 'vendor', 'tag_plugins.css')
  }
]

hexo.extend.filter.register('after_generate', () => {
  for (const asset of assets) {
    fs.mkdirSync(path.dirname(asset.to), { recursive: true })
    fs.copyFileSync(asset.from, asset.to)
  }
})
