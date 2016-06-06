/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/

import * as assert from 'assert';
import * as mockery from 'mockery';
import {Mock, It} from 'typemoq';

import * as testUtils from '../../testUtils';

/**
 * Unit tests for SourceMap + source-map (the mozilla lib). source-map is included in the test and not mocked
 */
suite('SourceMap', () => {
    const GENERATED_PATH = 'c:\\project\\app.js';

    setup(() => {
        testUtils.registerWin32Mocks();
        testUtils.setupUnhandledRejectionListener();
    });

    teardown(() => {
        testUtils.removeUnhandledRejectionListener();
    });

    suite('.sources', () => {
    });
});

function getMockSourceMapJSON(sources: string[], sourceRoot?: string): string {
    return JSON.stringify({
        sources,
        sourceRoot
    });
}
