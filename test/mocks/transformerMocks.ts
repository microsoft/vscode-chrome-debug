/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/

import {Mock, It} from 'typemoq';

import {LineNumberTransformer} from '../../src/transformers/lineNumberTransformer';
import {LazySourceMapTransformer} from '../../src/transformers/lazySourceMapTransformer';
import {PathTransformer} from '../../src/transformers/pathTransformer';

export function getMockLineNumberTransformer(): Mock<LineNumberTransformer> {
    return Mock.ofType(LineNumberTransformer);
}

export function getMockSourceMapTransformer(): Mock<LazySourceMapTransformer> {
    const mock = Mock.ofType(LazySourceMapTransformer);
    mock.setup(m => m.setBreakpoints(It.isAny(), It.isAny()))
        .returns(() => Promise.resolve<void>());

    return mock;
}

export function getMockPathTransformer(): Mock<PathTransformer> {
    const mock = Mock.ofType(PathTransformer);
    mock.setup(m => m.setBreakpoints(It.isAny()))
        .returns(() => Promise.resolve<void>());

    return mock;
}
