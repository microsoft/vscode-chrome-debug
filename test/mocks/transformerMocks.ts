/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/

import {Mock, It} from 'typemoq';

import {LineNumberTransformer} from '../../src/transformers/lineNumberTransformer';
import {BaseSourceMapTransformer} from '../../src/transformers/baseSourceMapTransformer';
import {UrlPathTransformer} from '../../src/transformers/urlPathTransformer';

export function getMockLineNumberTransformer(): Mock<LineNumberTransformer> {
    return Mock.ofType(LineNumberTransformer);
}

export function getMockSourceMapTransformer(): Mock<BaseSourceMapTransformer> {
    const mock = Mock.ofType(BaseSourceMapTransformer);
    mock.setup(m => m.setBreakpoints(It.isAny(), It.isAny()))
        .returns(() => Promise.resolve<void>());

    return mock;
}

export function getMockPathTransformer(): Mock<UrlPathTransformer> {
    const mock = Mock.ofType(UrlPathTransformer);
    mock.setup(m => m.setBreakpoints(It.isAny()))
        .returns(() => Promise.resolve<void>());

    return mock;
}
