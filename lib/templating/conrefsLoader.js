'use strict';

var path = require('path');
var nunjucks = require('nunjucks');

var fs = require('../utils/fs');
var LocationUtils = require('../utils/location');
var PathUtils = require('../utils/path');
var Git = require('../utils/git');

/**
 * Template loader resolving both:
 *      - relative url ("./test.md")
 *      - absolute url ("/test.md")
 *      - git url ("")
 *
 * @param {String} rootFolder
 * @param {Function(filePath, source)} transformFn (optional)
 * @param {Logger} logger (optional)
 */
var ConrefsLoader = nunjucks.Loader.extend({
    async: true,

    init: function init(rootFolder, transformFn, logger) {
        var git = arguments.length > 3 && arguments[3] !== undefined ? arguments[3] : new Git();

        this.rootFolder = rootFolder;
        this.transformFn = transformFn;
        this.logger = logger;
        this.git = git;
    },
    getSource: function getSource(sourceURL, callback) {
        var that = this;

        this.git.resolve(sourceURL).then(function (filepath) {
            // Is local file
            if (!filepath) {
                filepath = path.resolve(sourceURL);
            } else {
                if (that.logger) that.logger.debug.ln('resolve from git', sourceURL, 'to', filepath);
            }

            // Read file from absolute path
            return fs.readFile(filepath).then(function (source) {
                source = source.toString('utf8');

                if (that.transformFn) {
                    return that.transformFn(filepath, source);
                }

                return source;
            }).then(function (source) {
                return {
                    src: source,
                    path: filepath
                };
            });
        }).nodeify(callback);
    },
    resolve: function resolve(from, to) {
        // If origin is in the book, we enforce result file to be in the book
        if (PathUtils.isInRoot(this.rootFolder, from)) {

            // Path of current template in the rootFolder (not absolute to fs)
            var fromRelative = path.relative(this.rootFolder, from);

            // Resolve "to" to a filepath relative to rootFolder
            var href = LocationUtils.toAbsolute(to, path.dirname(fromRelative), '');

            // Return absolute path
            return PathUtils.resolveInRoot(this.rootFolder, href);
        }

        // If origin is in a git repository, we resolve file in the git repository
        var gitRoot = this.git.resolveRoot(from);
        if (gitRoot) {
            return PathUtils.resolveInRoot(gitRoot, to);
        }

        // If origin is not in the book (include from a git content ref)
        return path.resolve(path.dirname(from), to);
    },


    // Handle all files as relative, so that nunjucks pass responsability to 'resolve'
    isRelative: function isRelative(filename) {
        return LocationUtils.isRelative(filename);
    }
});

module.exports = ConrefsLoader;
//# sourceMappingURL=conrefsLoader.js.map