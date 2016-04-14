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

const sources = [
    'src',
    'test',
    'typings/main',
].map(function(tsFolder) { return tsFolder + '/**/*.ts'; });
sources.push('index.ts');

var libs = [
    'src',
    'typings'
].map(function(libFolder) { return libFolder + '/**/*.d.ts'; });

const lintSources = [
    'src',
    'test'
].map(function(tsFolder) { return tsFolder + '/**/*.ts'; });

const projectConfig = {
    noImplicitAny: false,
    target: 'ES5',
    module: 'commonjs',
    declaration: true,
    typescript: typescript
};

gulp.task('build', function () {
    var tsResult = gulp.src(sources, { base: '.' })
        .pipe(sourcemaps.init())
        .pipe(ts(projectConfig));

	return merge([
		tsResult.dts
        .pipe(gulp.dest('lib'))
        ,
		tsResult.js
        .pipe(sourcemaps.write('.', { includeContent: false, sourceRoot: 'file:///' + __dirname }))
        .pipe(gulp.dest('out'))
        ,
        gulp.src(libs, { base: '.' })
        .pipe(gulp.dest('lib'))
	]);
});

gulp.task('watch', ['build'], function(cb) {
    log('Watching build sources...');
    return gulp.watch(sources, ['build']);
});

gulp.task('default', ['build']);

gulp.task('tslint', function(){
      return gulp.src(lintSources, { base: '.' })
        .pipe(tslint())
        .pipe(tslint.report('verbose'));
});

function test() {
    return gulp.src('out/test/**/*.test.js', { read: false })
        .pipe(mocha({ ui: 'tdd' }))
        .on('error', function(e) {
            log(e ? e.toString() : 'error in test task!');
            this.emit('end');
        });
}

gulp.task('build-test', ['build'], test);
gulp.task('test', test);

gulp.task('watch-build-test', ['build', 'build-test'], function() {
    return gulp.watch(sources, ['build', 'build-test']);
});
