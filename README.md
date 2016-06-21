# VS Code - Debugger for Chrome
[![Join the chat at https://gitter.im/Microsoft/vscode-chrome-debug](https://badges.gitter.im/Microsoft/vscode-chrome-debug.svg)](https://gitter.im/Microsoft/vscode-chrome-debug?utm_source=badge&utm_medium=badge&utm_campaign=pr-badge&utm_content=badge)
[![build status](https://travis-ci.org/Microsoft/vscode-chrome-debug-core.svg?branch=master)](https://travis-ci.org/Microsoft/vscode-chrome-debug-core)

A library for building VS Code debug adapters for targets that support the [Chrome Debugging Protocol](https://chromedevtools.github.io/debugger-protocol-viewer/).

## To use in a new project
The consumer project needs to have these typings installed, since they are required by -core's exported .d.ts files, and since they're written as ambient typings, not modules.
```
npm install --save vscode-chrome-debug-core
npm install --save-dev typings
typings install --global --save dt~es6-collections dt~es6-promise dt~node
```

===
This project has adopted the [Microsoft Open Source Code of Conduct](https://opensource.microsoft.com/codeofconduct/). For more information see the [Code of Conduct FAQ](https://opensource.microsoft.com/codeofconduct/faq/) or contact [opencode@microsoft.com](mailto:opencode@microsoft.com) with any additional questions or comments.
