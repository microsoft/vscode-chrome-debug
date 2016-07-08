/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/

import * as assert from 'assert';
import * as mockery from 'mockery';

import * as testUtils from '../testUtils';

import {getComputedSourceRoot, applySourceMapPathOverrides, resolveWebRootPattern} from '../../src/sourceMaps/sourceMapUtils';
import {ISourceMapPathOverrides} from '../../src/debugAdapterInterfaces';

suite('SourceMapUtils', () => {
    setup(() => {
        testUtils.setupUnhandledRejectionListener();

        mockery.enable({ warnOnReplace: false, useCleanCache: true, warnOnUnregistered: false });
        testUtils.registerWin32Mocks();
    });

    teardown(() => {
        testUtils.removeUnhandledRejectionListener();
        mockery.deregisterAll();
        mockery.disable();
    });

    suite('resolveRelativeToFile', () => {
        // todo
    });

    suite('getComputedSourceRoot()', () => {
        const GEN_PATH = testUtils.pathResolve('/project/webroot/code/script.js');
        const GEN_URL = 'http://localhost:8080/code/script.js';
        const ABS_SOURCEROOT = testUtils.pathResolve('/project/src');
        const WEBROOT = testUtils.pathResolve('/project/webroot');

        test('handles file:/// sourceRoot', () => {
            assert.equal(
                getComputedSourceRoot('file:///' + ABS_SOURCEROOT, GEN_PATH, WEBROOT),
                ABS_SOURCEROOT);
        });

        test('handles /src style sourceRoot', () => {
            assert.equal(
                getComputedSourceRoot('/src', GEN_PATH, WEBROOT),
                testUtils.pathResolve('/project/webroot/src'));
        });

        test('handles ../../src style sourceRoot', () => {
            assert.equal(
                getComputedSourceRoot('../../src', GEN_PATH, WEBROOT),
                ABS_SOURCEROOT);
        });

        test('handles src style sourceRoot', () => {
            assert.equal(
                getComputedSourceRoot('src', GEN_PATH, WEBROOT),
                testUtils.pathResolve('/project/webroot/code/src'));
        });

        test('handles runtime script not on disk', () => {
            assert.equal(
                getComputedSourceRoot('../src', GEN_URL, WEBROOT),
                testUtils.pathResolve('/project/webroot/src'));
        });

        test('when no sourceRoot specified and runtime script is on disk, uses the runtime script dirname', () => {
            assert.equal(
                getComputedSourceRoot('', GEN_PATH, WEBROOT),
                testUtils.pathResolve('/project/webroot/code'));
        });

        test('when no sourceRoot specified and runtime script is not on disk, uses the runtime script dirname', () => {
            assert.equal(
                getComputedSourceRoot('', GEN_URL, WEBROOT),
                testUtils.pathResolve('/project/webroot/code'));
        });
    });

    suite('resolveWebRootPattern', () => {
        const WEBROOT = testUtils.pathResolve('/project/webroot');

        test('does nothing when no ${webRoot} present', () => {
            const overrides: ISourceMapPathOverrides = { '/src': '/project' };
            assert.deepEqual(
                resolveWebRootPattern(WEBROOT, overrides),
                overrides);
        });

        test('resolves the webRoot pattern', () => {
            assert.deepEqual(
                resolveWebRootPattern(WEBROOT, <ISourceMapPathOverrides>{ '/src': '${webRoot}/app/src'}),
                { '/src': WEBROOT + '/app/src' });
        });

        test(`ignores the webRoot pattern when it's not at the beginning of the string`, () => {
            const overrides: ISourceMapPathOverrides = { '/src': '/app/${webRoot}/src'};
            assert.deepEqual(
                resolveWebRootPattern(WEBROOT, overrides),
                overrides);
        });

        test('works on a set of overrides', () => {
            const overrides: ISourceMapPathOverrides = {
                '/src*': '${webRoot}/app',
                '*/app.js': '*/app.js',
                '/src/app.js': '/src/${webRoot}',
                '/app.js': '${webRoot}/app.js'
            };

            const expOverrides: ISourceMapPathOverrides = {
                '/src*': WEBROOT + '/app',
                '*/app.js': '*/app.js',
                '/src/app.js': '/src/${webRoot}',
                '/app.js': WEBROOT + '/app.js'
            };

            assert.deepEqual(
                resolveWebRootPattern(WEBROOT, overrides),
                expOverrides);
        });
    });

    suite('applySourceMapPathOverrides', () => {
        test('removes a matching webpack prefix', () => {
            assert.deepEqual(
                applySourceMapPathOverrides('webpack:///src/app.js', { 'webpack:///*': testUtils.pathResolve('/project/*') }),
                testUtils.pathResolve('/project/src/app.js'));
        });

        test('works using the laptop emoji', () => {
            assert.deepEqual(
                applySourceMapPathOverrides('meteor:///💻app/src/main.js', { 'meteor:///💻app/*': testUtils.pathResolve('/project/*')}),
                testUtils.pathResolve('/project/src/main.js'));
        });

        test('does nothing when no overrides match', () => {
            assert.deepEqual(
                applySourceMapPathOverrides('file:///c:/project/app.js', { 'webpack:///*': testUtils.pathResolve('/project/*') }),
                'file:///c:/project/app.js');
        });

        test('resolves ..', () => {
            assert.deepEqual(
                applySourceMapPathOverrides('/project/source/app.js', { '/project/source/*': testUtils.pathResolve('/') + 'project/../*' }),
                testUtils.pathResolve('/app.js'));
        });

        test(`does nothing when match but asterisks don't match`, () => {
            assert.deepEqual(
                applySourceMapPathOverrides('webpack:///src/app.js', { 'webpack:///src/app.js': testUtils.pathResolve('/project/*') }),
                'webpack:///src/app.js');
        });

        test(`does nothing when match but too many asterisks`, () => {
            assert.deepEqual(
                applySourceMapPathOverrides('webpack:///src/code/app.js', { 'webpack:///*/code/app.js': testUtils.pathResolve('/project/*/*') }),
                'webpack:///src/code/app.js');
        });

        test('replaces an asterisk in the middle', () => {
            assert.deepEqual(
                applySourceMapPathOverrides('webpack:///src/app.js', { 'webpack:///*/app.js': testUtils.pathResolve('/project/*/app.js') }),
                testUtils.pathResolve('/project/src/app.js'));
        });

        test('replaces an asterisk at the beginning', () => {
            assert.deepEqual(
                applySourceMapPathOverrides('/src/app.js', { '*/app.js': testUtils.pathResolve('/project/*/app.js') }),
                testUtils.pathResolve('/project/src/app.js'));
        });

        test('replaces correctly when asterisk on left but not right', () => {
            assert.deepEqual(
                applySourceMapPathOverrides('/src/app.js', { '*/app.js': testUtils.pathResolve('/project/app.js') }),
                testUtils.pathResolve('/project/app.js'));
        });

        test('the pattern is case-insensitive', () => {
            assert.deepEqual(
                applySourceMapPathOverrides('/src/app.js', { '*/APP.js': testUtils.pathResolve('/project/*/app.js') }),
                testUtils.pathResolve('/project/src/app.js'));
        });

        test('works when multiple overrides provided', () => {
            assert.deepEqual(
                applySourceMapPathOverrides(
                    '/src/app.js',
                    {
                        'foo': 'bar',
                        '/file.js': testUtils.pathResolve('/main.js'),
                        '*/app.js': testUtils.pathResolve('/project/*/app.js'),
                        '/something/*/else.js': 'main.js'
                    }),
                testUtils.pathResolve('/project/src/app.js'));
        });
    });
});
