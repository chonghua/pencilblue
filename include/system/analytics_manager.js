/*
    Copyright (C) 2014  PencilBlue, LLC

    This program is free software: you can redistribute it and/or modify
    it under the terms of the GNU General Public License as published by
    the Free Software Foundation, either version 3 of the License, or
    (at your option) any later version.

    This program is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
    GNU General Public License for more details.

    You should have received a copy of the GNU General Public License
    along with this program.  If not, see <http://www.gnu.org/licenses/>.
*/


function AnalyticsManager(){}

//statics
var PROVIDER_HOOKS = {};

/**
 * Takes the provided request and session then checks with each of the 
 * registered analytics providers to ensure get the HTML snippets to be 
 * executed for analytics reporting.
 * @method gatherData
 * @param {Request} req The current incoming request
 * @param {Object} session The current user session
 * @param {Localization} ls An instance of the Localization service
 * @param {Function} cb A callback that provides two parameters.  An error, if 
 * occurred, and a TemplateValue representing the HTML snippets for the analytic 
 * providers.
 */ 
AnalyticsManager.prototype.gatherData = function(req, session, ls, cb) {
    var tasks = pb.utils.getTasks(Object.keys(PROVIDER_HOOKS), function(keys, i) {
        return function(callback) {
            if (pb.log.isSilly()) {
                pb.log.silly("AnalyticsManager: Rendering provider [%s] for URL [%s:%s]", keys[i], req.method, req.url);
            }

            var th = setTimeout(function() {
                if (pb.log.isSilly()) {
                    pb.log.silly("AnalyticsManager: Rendering for provider [%s] timed out", keys[i]);
                }

                ts = null;
                callback(null, '');
            }, 20);

            var d = domain.create();
            d.run(function() {
                PROVIDER_HOOKS[keys[i]](req, session, ls, function(err, result) {
                    if (util.isError(err)) {
                        pb.log.error("AnalyticsManager: Rendering provider [%s] failed for URL [%s:%s]\n%s", keys[i], req.method, req.url, err.stack);
                    }

                    if (th) {
                        clearTimeout(th);
                        th = null;
                        
                        callback(null, result);
                    }
                });
            });
            d.on('error', function(err) {
                pb.log.error("AnalyticsManager: Rendering provider [%s] failed for URL [%s:%s]\n%s", keys[i], req.method, req.url, err.stack);
                if (th) {
                    clearTimeout(th);
                    th = null;
                    
                    callback(null, '');
                }
            });
        };
    });
    async.parallel(tasks, function(err, results) {
        cb(err, new pb.TemplateValue(results.join(''), false));
    });
};

/**
 * Registers an alaytics provider.  When a template is being rendered and 
 * encounters the ^analytics^ directive "onPageRender" is called.
 * @static
 * @method registerProvider
 * @param {String} name The provider's name
 * @param {Function} onPageRendering A function that is called for every 
 * requests that intends to execute HTML snippets to track analytics.  The 
 * function is expected to take 4 parameters.  The first is the current Request 
 * object.  The second is the current user session object. The third is an 
 * instance of Localization.  The last is a callback that should be called with 
 * two parameters.  The first is an error, if occurred and the second is raw 
 * HTML string that represents the snippet to be executed by the analytics 
 * plugin. 
 */
AnalyticsManager.registerProvider = function(name, onPageRendering) {
    if (!pb.validation.validateNonEmptyStr(name) || AnalyticsManager.isRegistered(name) || !pb.utils.isFunction(onPageRendering)) {
        return false;
    }

    PROVIDER_HOOKS[name] = onPageRendering;
    return true;
};

/**
 * Indicates if an analytics provider with the specified name has already 
 * registered itself.
 * @static
 * @method isRegistered
 * @param {String} name The name of the analytics provider to check registration for
 * @return {Boolean} TRUE when the provider is registered, FALSE if not
 */
AnalyticsManager.isRegistered = function(name) {
    return PROVIDER_HOOKS[name] !== undefined;
};

/**
 * Called when a page is rendering.  It creates a new instance of the analytics 
 * manager and constructs the javascript snippets (wrappered in TemplateValue) 
 * needed for the analytics plugins
 * @static
 * @method onPageRender
 * @param {Request} req
 * @param {Object} session
 * @param {Localization} ls
 * @param {Function} cb A callback that provides two parameters.  An error, if 
 * occurred, and a TemplateValue representing the HTML snippets for the analytic 
 * providers.
 */
AnalyticsManager.onPageRender = function(req, session, ls, cb) {
    var managerInstance = new AnalyticsManager();
    managerInstance.gatherData(req, session, ls, cb);
};

//exports
module.exports = AnalyticsManager;
