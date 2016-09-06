/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/

import {Mock, It} from 'typemoq';

import {LineNumberTransformer} from '../../src/transformers/lineNumberTransformer';
import {SourceMapTransformer} from '../../src/transformers/sourceMapTransformer';
import {PathTransformer} from '../../src/transformers/pathTransformer';

export function getMockLineNumberTransformer(): Mock<LineNumberTransformer> {
    return Mock.ofType(LineNumberTransformer);
}

export function getMockSourceMapTransformer(): Mock<SourceMapTransformer> {
    const mock = Mock.ofType(SourceMapTransformer);
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
