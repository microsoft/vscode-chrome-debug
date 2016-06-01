# VS Code - Debugger for Chrome

A library for building VS Code debug adapters for targets that support the [Chrome Debugging Protocol](https://chromedevtools.github.io/debugger-protocol-viewer/).


## To use in a new project
The consumer project needs to have these typings installed, since they are required by -core's exported .d.ts files, and since they're written as ambient typings, not modules.
`npm install --save vscode-chrome-debug-core`
`npm install --save-dev typings`
`typings install --global --save es6-collections es6-promise node`