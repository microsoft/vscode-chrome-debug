# VS Code - Debugger for Chrome
[![build status](https://travis-ci.org/Microsoft/vscode-chrome-debug-core.svg?branch=master)](https://travis-ci.org/Microsoft/vscode-chrome-debug-core)

A library for building VS Code debug adapters for targets that support the [Chrome Debugging Protocol](https://chromedevtools.github.io/debugger-protocol-viewer/).

## To use in a new project
The consumer project needs to have these typings installed, since they are required by -core's exported .d.ts files, and since they're written as ambient typings, not modules.
```
npm install --save vscode-chrome-debug-core
npm install --save-dev typings
typings install --global --save dt~es6-collections dt~es6-promise dt~node
```
