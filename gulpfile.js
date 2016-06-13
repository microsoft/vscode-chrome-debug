/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/

const gulp = require('gulp');
const path = require('path');
const ts = require('gulp-typescript');
const log = require('gulp-util').log;
const typescript = require('typescript');
const sourcemaps = require('gulp-sourcemaps');
const mocha = require('gulp-mocha');
const tslint = require('gulp-tslint');
const merge = require('merge2');
const debug = require('gulp-debug');
const del = require('del');
const plumber = require('gulp-plumber');

const sources = [
    'src',
    'test',
    'typings',
].map(tsFolder => tsFolder + '/**/*.ts');

// tsBuildSources needs to explicitly exclude testData because it's built and copied separately.
const testDataDir = 'test/**/testData/';
const tsBuildSources = sources.slice();
tsBuildSources.push('!' + testDataDir + '**');

const libs = [
    'src',
    'typings'
].map(libFolder => libFolder + '/**/*.d.ts');

const lintSources = [
    'src',
    'test'
].map(tsFolder => tsFolder + '/**/*.ts');

const projectConfig = {
    noImplicitAny: false,
    target: 'ES5',
    module: 'commonjs',
    moduleResolution: 'node',
    declaration: true,
    typescript,
    outDir: 'out'
};

function computeSourceRoot(file) {
    return path.relative(path.dirname(file.path), __dirname);
}

const tsProject = ts.createProject(projectConfig);
gulp.task('build', () => {
    const tsResult = gulp.src(tsBuildSources, { base: '.' })
        .pipe(plumber())
        .pipe(sourcemaps.init())
        .pipe(ts(tsProject));

	return merge([
		tsResult.dts
            .pipe(gulp.dest('lib')),
		tsResult.js
            .pipe(sourcemaps.write('.', { includeContent: false, sourceRoot: computeSourceRoot }))
            .pipe(gulp.dest('out')),
        gulp.src(libs, { base: '.' })
            .pipe(gulp.dest('lib')),
        gulp.src(testDataDir + 'app*', { base: '.' })
            .pipe(gulp.dest('out'))
	]);
});

gulp.task('clean', () => {
    return del(['out', 'lib']);
});

gulp.task('watch', ['build'], () => {
    log('Watching build sources...');
    return gulp.watch(sources, ['build']);
});

gulp.task('default', ['build']);

gulp.task('tslint', () => {
      return gulp.src(lintSources, { base: '.' })
        .pipe(tslint())
        .pipe(tslint.report('verbose'));
});

function test() {
    return gulp.src('out/test/**/*.test.js', { read: false })
        .pipe(mocha({ ui: 'tdd' }))
        .on('error', e => {
            log(e ? e.toString() : 'error in test task!');
            this.emit('end');
        });
}

gulp.task('build-test', ['build'], test);
gulp.task('test', test);

gulp.task('watch-build-test', ['build', 'build-test'], () => {
    return gulp.watch(sources, ['build', 'build-test']);
});
