## 1.0.0 - Largest update ever!
* Evaluate getters in the variables pane - [Microsoft/vscode-chrome-debug-core#77](https://github.com/Microsoft/vscode-chrome-debug-core/issues/77)
* Paging chunks of large arrays - [Microsoft/vscode-chrome-debug-core#4](https://github.com/Microsoft/vscode-chrome-debug-core/issues/4)
* Show Map/Set members - [Microsoft/vscode-chrome-debug-core#31](https://github.com/Microsoft/vscode-chrome-debug-core/issues/31)
* Show inlined sources when the source can't be resolved to a file on disk - [Microsoft/vscode-chrome-debug-core#85](https://github.com/Microsoft/vscode-chrome-debug-core/issues/85)
* Hover on breakpoints to see error messages when breakpoints don't bind - [Microsoft/vscode-chrome-debug-core#38](https://github.com/Microsoft/vscode-chrome-debug-core/issues/38)
* Editing variable values - [Microsoft/vscode-chrome-debug-core#58](https://github.com/Microsoft/vscode-chrome-debug-core/issues/58)
* Conditional breakpoints - [Microsoft/vscode-chrome-debug-core#10](https://github.com/Microsoft/vscode-chrome-debug-core/issues/10)

## 0.4.8
* Fix for not attaching correctly when using the 'launch' config with Chrome already open - [#79](https://github.com/Microsoft/vscode-chrome-debug/issues/79)
    * Note - as part of this, it will no longer attach to a random tab when it can't find a match using the `"url"` parameter. If that parameter is set in the launch config, there must be a match.
* Make the attach retry logic more resilient.
* Support wildcards in the `"url"` parameter for 'attach' configs - [#200](https://github.com/Microsoft/vscode-chrome-debug/issues/200)
* Fix `NaN` and `Infinity` display - [#190](https://github.com/Microsoft/vscode-chrome-debug/issues/190)
* Fix `sourceMapPathOverrides` doc mistake - [#194](https://github.com/Microsoft/vscode-chrome-debug/issues/194), thanks @lijunle!
