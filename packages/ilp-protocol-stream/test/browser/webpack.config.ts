import path from 'path'
import { Configuration } from 'webpack'

const config: Configuration = {
  mode: 'development',
  entry: './test/browser/main.js',
  resolve: {
    aliasFields: ['browser'],
    extensions: ['.tsx', '.ts', '.js', '.json'],
  },
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        loader: 'ts-loader',
        options: {
          onlyCompileBundledFiles: true,
          configFile: path.resolve(__dirname, '../../tsconfig.build.json'),
        },
      },
    ],
  },
  output: {
    filename: 'dist/test/browser/bundle.js',
    path: path.resolve(__dirname, '../..'),
  },
  optimization: { usedExports: true },

  node: {
    console: true,
    fs: 'empty',
    net: 'empty',
    tls: 'empty',
    crypto: 'empty',
  },
}

export default config
