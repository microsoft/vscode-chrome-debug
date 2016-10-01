/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/

import {Mock, It} from 'typemoq';

import {LineColTransformer} from '../../src/transformers/lineNumberTransformer';
import {BaseSourceMapTransformer} from '../../src/transformers/baseSourceMapTransformer';
import {UrlPathTransformer} from '../../src/transformers/urlPathTransformer';

export function getMockLineNumberTransformer(): Mock<LineColTransformer> {
    return Mock.ofType(LineColTransformer);
}

export function getMockSourceMapTransformer(): Mock<BaseSourceMapTransformer> {
    const mock = Mock.ofType(BaseSourceMapTransformer);
    mock.setup(m => m.setBreakpoints(It.isAny(), It.isAny()))
        .returns(() => true);

    mock.setup(m => m.getGeneratedPathFromAuthoredPath(It.isAnyString()))
        .returns(somePath => Promise.resolve(somePath));

    return mock;
}

export function getMockPathTransformer(): Mock<UrlPathTransformer> {
    const mock = Mock.ofType(UrlPathTransformer);
    mock.setup(m => m.setBreakpoints(It.isAny()))
        .returns(() => true);

    mock.setup(m => m.getTargetPathFromClientPath(It.isAnyString()))
            .returns(somePath => somePath);

    return mock;
}
