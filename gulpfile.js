/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/

const ts = require('gulp-typescript');
const typescript = require('typescript');
const sourcemaps = require('gulp-sourcemaps');
const gulp = require('gulp');
const log = require('gulp-util').log;
const path = require('path');
const fs = require('fs');
const nls = require('vscode-nls-dev');
const vsce = require('vsce');
const es = require('event-stream');
const runSequence = require('run-sequence');

const transifexApiHostname = 'www.transifex.com'
const transifexApiName = 'api';
const transifexApiToken = process.env.TRANSIFEX_API_TOKEN;
const transifexProjectName = 'vscode-extensions';
const transifexExtensionName = 'vscode-chrome-debug';
const vscodeLanguages = [
    'zh-hans',
    'zh-hant',
    'ja',
    'ko',
    'de',
    'fr',
    'es',
    'ru',
    'it',
    'pt-br',
    'hu',
    'tr'
];

const watchedSources = [
    'src/**/*',
    'test/**/*'
];

const scripts = [
    'src/terminateProcess.sh'
];

const lintSources = [
    'src'
].map(function (tsFolder) { return tsFolder + '/**/*.ts'; });

const tsProject = ts.createProject('tsconfig.json', { typescript });
function doBuild(buildNls, failOnError) {
    let gotError = false;

    const tsResult = tsProject.src()
        .pipe(sourcemaps.init())
        .pipe(tsProject())
        .once('error', () => {
            gotError = true;
        });

    return tsResult.js
        .pipe(buildNls ? nls.rewriteLocalizeCalls() : es.through())
        .pipe(buildNls ? nls.createAdditionalLanguageFiles(nls.coreLanguages, 'i18n', 'out') : es.through())
        .pipe(sourcemaps.write('.', { includeContent: false, sourceRoot: '.' })) // .. to compensate for TS returning paths from 'out'
        .pipe(gulp.dest('out'))
        .once('error', () => {
            gotError = true;
        })
        .once('finish', () => {
            if (failOnError && gotError) {
                process.exit(1);
            }
        });
}

gulp.task('build', ['copy-scripts'], function () {
    doBuild(true, true);
});

gulp.task('dev-build', ['copy-scripts'], function () {
    doBuild(false, false);
});

gulp.task('copy-scripts', () => {
    return gulp.src(scripts, { base: '.' })
        .pipe(gulp.dest('out'));
});

gulp.task('watch', ['dev-build'], function (cb) {
    log('Watching build sources...');
    return gulp.watch(watchedSources, ['dev-build']);
});

gulp.task('default', ['build']);

gulp.task('tslint', function () {
    return gulp.src(lintSources, { base: '.' })
        .pipe(tslint({
            formatter: "verbose"
        }))
        .pipe(tslint.report({ emitError: false }));
});

gulp.task('clean', function () {
    return del(['out/**', 'package.nls.*.json', 'vscode-chrome-debug-*.vsix']);
});

function verifyNotALinkedModule(modulePath) {
    return new Promise((resolve, reject) => {
        fs.lstat(modulePath, (err, stat) => {
            if (stat.isSymbolicLink()) {
                reject(new Error('Symbolic link found: ' + modulePath));
            } else {
                resolve();
            }
        });
    });
}

function verifyNoLinkedModules() {
    return new Promise((resolve, reject) => {
        fs.readdir('./node_modules', (err, files) => {
            Promise.all(files.map(file => {
                const modulePath = path.join('.', 'node_modules', file);
                return verifyNotALinkedModule(modulePath);
            })).then(resolve, reject);
        });
    });
}

gulp.task('verify-no-linked-modules', cb => verifyNoLinkedModules().then(() => cb, cb));

gulp.task('vsce-publish', function () {
    return vsce.publish();
});
gulp.task('vsce-package', function () {
    return vsce.createVSIX();
});

gulp.task('publish', function (callback) {
    runSequence('build', 'add-i18n', 'vsce-publish', callback);
});

gulp.task('package', function (callback) {
    runSequence('build', 'add-i18n', 'vsce-package', callback);
});

gulp.task('add-i18n', function () {
    return gulp.src(['package.nls.json'])
        .pipe(nls.createAdditionalLanguageFiles(nls.coreLanguages, 'i18n'))
        .pipe(gulp.dest('.'));
});

gulp.task('transifex-push', function () {
    return gulp.src('**/*.nls.json')
        .pipe(nls.prepareXlfFiles(transifexProjectName, transifexExtensionName))
        .pipe(nls.pushXlfFiles(transifexApiHostname, transifexApiName, transifexApiToken));
});

gulp.task('transifex-pull', function () {
    return nls.pullXlfFiles(transifexApiHostname, transifexApiName, transifexApiToken, vscodeLanguages, [{ name: transifexExtensionName, project: transifexProjectName }])
        .pipe(gulp.dest(`../${transifexExtensionName}-localization`));
});

gulp.task('i18n-import', function () {
    return gulp.src(`../${transifexExtensionName}-localization/**/*.xlf`)
        .pipe(nls.prepareJsonFiles())
        .pipe(gulp.dest('./i18n'));
});
