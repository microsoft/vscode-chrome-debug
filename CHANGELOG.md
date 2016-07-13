## 0.4.8
* Fix for not attaching correctly when using the 'launch' config with Chrome already open - [#79](https://github.com/Microsoft/vscode-chrome-debug/issues/79)
    * Note - as part of this, it will no longer attach to a random tab when it can't find a match using the `"url"` parameter. If that parameter is set in the launch config, there must be a match.
* Make the attach retry logic more resilient.
* Support wildcards in the `"url"` parameter for 'attach' configs - [#200](https://github.com/Microsoft/vscode-chrome-debug/issues/200)
* Fix `NaN` and `Infinity` display - [#190](https://github.com/Microsoft/vscode-chrome-debug/issues/190)
* Fix `sourceMapPathOverrides` doc mistake - [#194](https://github.com/Microsoft/vscode-chrome-debug/issues/194), thanks @lijunle!
