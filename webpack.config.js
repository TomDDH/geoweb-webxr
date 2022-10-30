const webpack = require("webpack");
const path = require("path");

const HtmlWebpackPlugin = require("html-webpack-plugin");
const CopyPlugin = require("copy-webpack-plugin");
const dist = path.resolve(__dirname, "dist");
const src = path.resolve(__dirname, "src");
const MiniCssExtractPlugin = require("mini-css-extract-plugin")
const Dotenv = require('dotenv-webpack');


module.exports = {
  entry: path.resolve(src, "index.js"),
  output: {
    filename: "[name].js",
    path: dist,
    clean: true,
  },
  module: {
    rules: [
      {
        test: /\.css$/i,
        use: [MiniCssExtractPlugin.loader, {loader:"css-loader",
        options: {
          url: false,
        }
      }],
      },
      {
        test: /\.(gltf|glb)$/,
        use: [
          {
            loader: 'file-loader',
            options: {}
          }
        ]
      }
    ],
  },
  devServer: {
    static: {
      directory: path.join(__dirname, "src"),
    },
    watchFiles: ["src/**"],
    open: true,
    https: true,
    host: "local-ip",
    allowedHosts: "all",
    port: 9000,
    client: {
      overlay: true,
    },
  },
  plugins: [
    new HtmlWebpackPlugin({
      template: path.resolve(src, "index.html"),
    }),
    new Dotenv(),
    new MiniCssExtractPlugin(),
    new webpack.HotModuleReplacementPlugin(),
    // new CopyPlugin({
    //   patterns: [{ from: "src/assets", to: "assets" }],
    // }),
  ],
};
