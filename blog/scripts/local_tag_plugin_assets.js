'use strict'

const fs = require('fs')
const path = require('path')

const pluginRoot = path.join(hexo.base_dir, 'node_modules', 'hexo-butterfly-tag-plugins-plus')
const assets = [
  {
    from: path.join(hexo.base_dir, 'node_modules', '@egjs', 'infinitegrid', 'dist', 'infinitegrid.min.js'),
    to: path.join(hexo.public_dir, 'js', 'vendor', 'infinitegrid.min.js')
  },
  {
    from: path.join(hexo.base_dir, 'node_modules', '@fortawesome', 'fontawesome-free', 'css', 'all.min.css'),
    to: path.join(hexo.public_dir, 'css', 'vendor', 'fontawesome', 'all.min.css')
  },
  {
    from: path.join(pluginRoot, 'lib', 'assets', 'font-awesome-animation.min.css'),
    to: path.join(hexo.public_dir, 'css', 'vendor', 'font-awesome-animation.min.css')
  },
  {
    from: path.join(hexo.base_dir, 'node_modules', 'medium-zoom', 'dist', 'medium-zoom.min.js'),
    to: path.join(hexo.public_dir, 'js', 'vendor', 'medium-zoom.min.js')
  },
  {
    from: path.join(hexo.base_dir, 'node_modules', 'node-snackbar', 'dist', 'snackbar.min.css'),
    to: path.join(hexo.public_dir, 'css', 'vendor', 'snackbar.min.css')
  },
  {
    from: path.join(hexo.base_dir, 'node_modules', 'node-snackbar', 'dist', 'snackbar.min.js'),
    to: path.join(hexo.public_dir, 'js', 'vendor', 'snackbar.min.js')
  },
  {
    from: path.join(pluginRoot, 'lib', 'tag_plugins.css'),
    to: path.join(hexo.public_dir, 'css', 'vendor', 'tag_plugins.css')
  },
  {
    from: path.join(hexo.base_dir, 'node_modules', 'vanilla-lazyload', 'dist', 'lazyload.iife.min.js'),
    to: path.join(hexo.public_dir, 'js', 'vendor', 'lazyload.iife.min.js')
  }
]

hexo.extend.filter.register('after_generate', () => {
  for (const asset of assets) {
    fs.mkdirSync(path.dirname(asset.to), { recursive: true })
    fs.copyFileSync(asset.from, asset.to)
  }
})
