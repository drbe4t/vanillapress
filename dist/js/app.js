(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
// shim for using process in browser

var process = module.exports = {};
var queue = [];
var draining = false;
var currentQueue;
var queueIndex = -1;

function cleanUpNextTick() {
    draining = false;
    if (currentQueue.length) {
        queue = currentQueue.concat(queue);
    } else {
        queueIndex = -1;
    }
    if (queue.length) {
        drainQueue();
    }
}

function drainQueue() {
    if (draining) {
        return;
    }
    var timeout = setTimeout(cleanUpNextTick);
    draining = true;

    var len = queue.length;
    while(len) {
        currentQueue = queue;
        queue = [];
        while (++queueIndex < len) {
            if (currentQueue) {
                currentQueue[queueIndex].run();
            }
        }
        queueIndex = -1;
        len = queue.length;
    }
    currentQueue = null;
    draining = false;
    clearTimeout(timeout);
}

process.nextTick = function (fun) {
    var args = new Array(arguments.length - 1);
    if (arguments.length > 1) {
        for (var i = 1; i < arguments.length; i++) {
            args[i - 1] = arguments[i];
        }
    }
    queue.push(new Item(fun, args));
    if (queue.length === 1 && !draining) {
        setTimeout(drainQueue, 0);
    }
};

// v8 likes predictible objects
function Item(fun, array) {
    this.fun = fun;
    this.array = array;
}
Item.prototype.run = function () {
    this.fun.apply(null, this.array);
};
process.title = 'browser';
process.browser = true;
process.env = {};
process.argv = [];
process.version = ''; // empty string to avoid regexp issues
process.versions = {};

function noop() {}

process.on = noop;
process.addListener = noop;
process.once = noop;
process.off = noop;
process.removeListener = noop;
process.removeAllListeners = noop;
process.emit = noop;

process.binding = function (name) {
    throw new Error('process.binding is not supported');
};

process.cwd = function () { return '/' };
process.chdir = function (dir) {
    throw new Error('process.chdir is not supported');
};
process.umask = function() { return 0; };

},{}],2:[function(require,module,exports){
(function (process){
  /* globals require, module */

  'use strict';

  /**
   * Module dependencies.
   */

  var pathtoRegexp = require('path-to-regexp');

  /**
   * Module exports.
   */

  module.exports = page;

  /**
   * Detect click event
   */
  var clickEvent = ('undefined' !== typeof document) && document.ontouchstart ? 'touchstart' : 'click';

  /**
   * To work properly with the URL
   * history.location generated polyfill in https://github.com/devote/HTML5-History-API
   */

  var location = ('undefined' !== typeof window) && (window.history.location || window.location);

  /**
   * Perform initial dispatch.
   */

  var dispatch = true;


  /**
   * Decode URL components (query string, pathname, hash).
   * Accommodates both regular percent encoding and x-www-form-urlencoded format.
   */
  var decodeURLComponents = true;

  /**
   * Base path.
   */

  var base = '';

  /**
   * Running flag.
   */

  var running;

  /**
   * HashBang option
   */

  var hashbang = false;

  /**
   * Previous context, for capturing
   * page exit events.
   */

  var prevContext;

  /**
   * Register `path` with callback `fn()`,
   * or route `path`, or redirection,
   * or `page.start()`.
   *
   *   page(fn);
   *   page('*', fn);
   *   page('/user/:id', load, user);
   *   page('/user/' + user.id, { some: 'thing' });
   *   page('/user/' + user.id);
   *   page('/from', '/to')
   *   page();
   *
   * @param {String|Function} path
   * @param {Function} fn...
   * @api public
   */

  function page(path, fn) {
    // <callback>
    if ('function' === typeof path) {
      return page('*', path);
    }

    // route <path> to <callback ...>
    if ('function' === typeof fn) {
      var route = new Route(path);
      for (var i = 1; i < arguments.length; ++i) {
        page.callbacks.push(route.middleware(arguments[i]));
      }
      // show <path> with [state]
    } else if ('string' === typeof path) {
      page['string' === typeof fn ? 'redirect' : 'show'](path, fn);
      // start [options]
    } else {
      page.start(path);
    }
  }

  /**
   * Callback functions.
   */

  page.callbacks = [];
  page.exits = [];

  /**
   * Current path being processed
   * @type {String}
   */
  page.current = '';

  /**
   * Number of pages navigated to.
   * @type {number}
   *
   *     page.len == 0;
   *     page('/login');
   *     page.len == 1;
   */

  page.len = 0;

  /**
   * Get or set basepath to `path`.
   *
   * @param {String} path
   * @api public
   */

  page.base = function(path) {
    if (0 === arguments.length) return base;
    base = path;
  };

  /**
   * Bind with the given `options`.
   *
   * Options:
   *
   *    - `click` bind to click events [true]
   *    - `popstate` bind to popstate [true]
   *    - `dispatch` perform initial dispatch [true]
   *
   * @param {Object} options
   * @api public
   */

  page.start = function(options) {
    options = options || {};
    if (running) return;
    running = true;
    if (false === options.dispatch) dispatch = false;
    if (false === options.decodeURLComponents) decodeURLComponents = false;
    if (false !== options.popstate) window.addEventListener('popstate', onpopstate, false);
    if (false !== options.click) {
      document.addEventListener(clickEvent, onclick, false);
    }
    if (true === options.hashbang) hashbang = true;
    if (!dispatch) return;
    var url = (hashbang && ~location.hash.indexOf('#!')) ? location.hash.substr(2) + location.search : location.pathname + location.search + location.hash;
    page.replace(url, null, true, dispatch);
  };

  /**
   * Unbind click and popstate event handlers.
   *
   * @api public
   */

  page.stop = function() {
    if (!running) return;
    page.current = '';
    page.len = 0;
    running = false;
    document.removeEventListener(clickEvent, onclick, false);
    window.removeEventListener('popstate', onpopstate, false);
  };

  /**
   * Show `path` with optional `state` object.
   *
   * @param {String} path
   * @param {Object} state
   * @param {Boolean} dispatch
   * @return {Context}
   * @api public
   */

  page.show = function(path, state, dispatch, push) {
    var ctx = new Context(path, state);
    page.current = ctx.path;
    if (false !== dispatch) page.dispatch(ctx);
    if (false !== ctx.handled && false !== push) ctx.pushState();
    return ctx;
  };

  /**
   * Goes back in the history
   * Back should always let the current route push state and then go back.
   *
   * @param {String} path - fallback path to go back if no more history exists, if undefined defaults to page.base
   * @param {Object} [state]
   * @api public
   */

  page.back = function(path, state) {
    if (page.len > 0) {
      // this may need more testing to see if all browsers
      // wait for the next tick to go back in history
      history.back();
      page.len--;
    } else if (path) {
      setTimeout(function() {
        page.show(path, state);
      });
    }else{
      setTimeout(function() {
        page.show(base, state);
      });
    }
  };


  /**
   * Register route to redirect from one path to other
   * or just redirect to another route
   *
   * @param {String} from - if param 'to' is undefined redirects to 'from'
   * @param {String} [to]
   * @api public
   */
  page.redirect = function(from, to) {
    // Define route from a path to another
    if ('string' === typeof from && 'string' === typeof to) {
      page(from, function(e) {
        setTimeout(function() {
          page.replace(to);
        }, 0);
      });
    }

    // Wait for the push state and replace it with another
    if ('string' === typeof from && 'undefined' === typeof to) {
      setTimeout(function() {
        page.replace(from);
      }, 0);
    }
  };

  /**
   * Replace `path` with optional `state` object.
   *
   * @param {String} path
   * @param {Object} state
   * @return {Context}
   * @api public
   */


  page.replace = function(path, state, init, dispatch) {
    var ctx = new Context(path, state);
    page.current = ctx.path;
    ctx.init = init;
    ctx.save(); // save before dispatching, which may redirect
    if (false !== dispatch) page.dispatch(ctx);
    return ctx;
  };

  /**
   * Dispatch the given `ctx`.
   *
   * @param {Object} ctx
   * @api private
   */

  page.dispatch = function(ctx) {
    var prev = prevContext,
      i = 0,
      j = 0;

    prevContext = ctx;

    function nextExit() {
      var fn = page.exits[j++];
      if (!fn) return nextEnter();
      fn(prev, nextExit);
    }

    function nextEnter() {
      var fn = page.callbacks[i++];

      if (ctx.path !== page.current) {
        ctx.handled = false;
        return;
      }
      if (!fn) return unhandled(ctx);
      fn(ctx, nextEnter);
    }

    if (prev) {
      nextExit();
    } else {
      nextEnter();
    }
  };

  /**
   * Unhandled `ctx`. When it's not the initial
   * popstate then redirect. If you wish to handle
   * 404s on your own use `page('*', callback)`.
   *
   * @param {Context} ctx
   * @api private
   */

  function unhandled(ctx) {
    if (ctx.handled) return;
    var current;

    if (hashbang) {
      current = base + location.hash.replace('#!', '');
    } else {
      current = location.pathname + location.search;
    }

    if (current === ctx.canonicalPath) return;
    page.stop();
    ctx.handled = false;
    location.href = ctx.canonicalPath;
  }

  /**
   * Register an exit route on `path` with
   * callback `fn()`, which will be called
   * on the previous context when a new
   * page is visited.
   */
  page.exit = function(path, fn) {
    if (typeof path === 'function') {
      return page.exit('*', path);
    }

    var route = new Route(path);
    for (var i = 1; i < arguments.length; ++i) {
      page.exits.push(route.middleware(arguments[i]));
    }
  };

  /**
   * Remove URL encoding from the given `str`.
   * Accommodates whitespace in both x-www-form-urlencoded
   * and regular percent-encoded form.
   *
   * @param {str} URL component to decode
   */
  function decodeURLEncodedURIComponent(val) {
    if (typeof val !== 'string') { return val; }
    return decodeURLComponents ? decodeURIComponent(val.replace(/\+/g, ' ')) : val;
  }

  /**
   * Initialize a new "request" `Context`
   * with the given `path` and optional initial `state`.
   *
   * @param {String} path
   * @param {Object} state
   * @api public
   */

  function Context(path, state) {
    if ('/' === path[0] && 0 !== path.indexOf(base)) path = base + (hashbang ? '#!' : '') + path;
    var i = path.indexOf('?');

    this.canonicalPath = path;
    this.path = path.replace(base, '') || '/';
    if (hashbang) this.path = this.path.replace('#!', '') || '/';

    this.title = document.title;
    this.state = state || {};
    this.state.path = path;
    this.querystring = ~i ? decodeURLEncodedURIComponent(path.slice(i + 1)) : '';
    this.pathname = decodeURLEncodedURIComponent(~i ? path.slice(0, i) : path);
    this.params = {};

    // fragment
    this.hash = '';
    if (!hashbang) {
      if (!~this.path.indexOf('#')) return;
      var parts = this.path.split('#');
      this.path = parts[0];
      this.hash = decodeURLEncodedURIComponent(parts[1]) || '';
      this.querystring = this.querystring.split('#')[0];
    }
  }

  /**
   * Expose `Context`.
   */

  page.Context = Context;

  /**
   * Push state.
   *
   * @api private
   */

  Context.prototype.pushState = function() {
    page.len++;
    history.pushState(this.state, this.title, hashbang && this.path !== '/' ? '#!' + this.path : this.canonicalPath);
  };

  /**
   * Save the context state.
   *
   * @api public
   */

  Context.prototype.save = function() {
    history.replaceState(this.state, this.title, hashbang && this.path !== '/' ? '#!' + this.path : this.canonicalPath);
  };

  /**
   * Initialize `Route` with the given HTTP `path`,
   * and an array of `callbacks` and `options`.
   *
   * Options:
   *
   *   - `sensitive`    enable case-sensitive routes
   *   - `strict`       enable strict matching for trailing slashes
   *
   * @param {String} path
   * @param {Object} options.
   * @api private
   */

  function Route(path, options) {
    options = options || {};
    this.path = (path === '*') ? '(.*)' : path;
    this.method = 'GET';
    this.regexp = pathtoRegexp(this.path,
      this.keys = [],
      options.sensitive,
      options.strict);
  }

  /**
   * Expose `Route`.
   */

  page.Route = Route;

  /**
   * Return route middleware with
   * the given callback `fn()`.
   *
   * @param {Function} fn
   * @return {Function}
   * @api public
   */

  Route.prototype.middleware = function(fn) {
    var self = this;
    return function(ctx, next) {
      if (self.match(ctx.path, ctx.params)) return fn(ctx, next);
      next();
    };
  };

  /**
   * Check if this route matches `path`, if so
   * populate `params`.
   *
   * @param {String} path
   * @param {Object} params
   * @return {Boolean}
   * @api private
   */

  Route.prototype.match = function(path, params) {
    var keys = this.keys,
      qsIndex = path.indexOf('?'),
      pathname = ~qsIndex ? path.slice(0, qsIndex) : path,
      m = this.regexp.exec(decodeURIComponent(pathname));

    if (!m) return false;

    for (var i = 1, len = m.length; i < len; ++i) {
      var key = keys[i - 1];
      var val = decodeURLEncodedURIComponent(m[i]);
      if (val !== undefined || !(hasOwnProperty.call(params, key.name))) {
        params[key.name] = val;
      }
    }

    return true;
  };


  /**
   * Handle "populate" events.
   */

  var onpopstate = (function () {
    var loaded = false;
    if ('undefined' === typeof window) {
      return;
    }
    if (document.readyState === 'complete') {
      loaded = true;
    } else {
      window.addEventListener('load', function() {
        setTimeout(function() {
          loaded = true;
        }, 0);
      });
    }
    return function onpopstate(e) {
      if (!loaded) return;
      if (e.state) {
        var path = e.state.path;
        page.replace(path, e.state);
      } else {
        page.show(location.pathname + location.hash, undefined, undefined, false);
      }
    };
  })();
  /**
   * Handle "click" events.
   */

  function onclick(e) {

    if (1 !== which(e)) return;

    if (e.metaKey || e.ctrlKey || e.shiftKey) return;
    if (e.defaultPrevented) return;



    // ensure link
    var el = e.target;
    while (el && 'A' !== el.nodeName) el = el.parentNode;
    if (!el || 'A' !== el.nodeName) return;



    // Ignore if tag has
    // 1. "download" attribute
    // 2. rel="external" attribute
    if (el.hasAttribute('download') || el.getAttribute('rel') === 'external') return;

    // ensure non-hash for the same path
    var link = el.getAttribute('href');
    if (!hashbang && el.pathname === location.pathname && (el.hash || '#' === link)) return;



    // Check for mailto: in the href
    if (link && link.indexOf('mailto:') > -1) return;

    // check target
    if (el.target) return;

    // x-origin
    if (!sameOrigin(el.href)) return;



    // rebuild path
    var path = el.pathname + el.search + (el.hash || '');

    // strip leading "/[drive letter]:" on NW.js on Windows
    if (typeof process !== 'undefined' && path.match(/^\/[a-zA-Z]:\//)) {
      path = path.replace(/^\/[a-zA-Z]:\//, '/');
    }

    // same page
    var orig = path;

    if (path.indexOf(base) === 0) {
      path = path.substr(base.length);
    }

    if (hashbang) path = path.replace('#!', '');

    if (base && orig === path) return;

    e.preventDefault();
    page.show(orig);
  }

  /**
   * Event button.
   */

  function which(e) {
    e = e || window.event;
    return null === e.which ? e.button : e.which;
  }

  /**
   * Check if `href` is the same origin.
   */

  function sameOrigin(href) {
    var origin = location.protocol + '//' + location.hostname;
    if (location.port) origin += ':' + location.port;
    return (href && (0 === href.indexOf(origin)));
  }

  page.sameOrigin = sameOrigin;

}).call(this,require('_process'))
},{"_process":1,"path-to-regexp":3}],3:[function(require,module,exports){
var isarray = require('isarray')

/**
 * Expose `pathToRegexp`.
 */
module.exports = pathToRegexp
module.exports.parse = parse
module.exports.compile = compile
module.exports.tokensToFunction = tokensToFunction
module.exports.tokensToRegExp = tokensToRegExp

/**
 * The main path matching regexp utility.
 *
 * @type {RegExp}
 */
var PATH_REGEXP = new RegExp([
  // Match escaped characters that would otherwise appear in future matches.
  // This allows the user to escape special characters that won't transform.
  '(\\\\.)',
  // Match Express-style parameters and un-named parameters with a prefix
  // and optional suffixes. Matches appear as:
  //
  // "/:test(\\d+)?" => ["/", "test", "\d+", undefined, "?", undefined]
  // "/route(\\d+)"  => [undefined, undefined, undefined, "\d+", undefined, undefined]
  // "/*"            => ["/", undefined, undefined, undefined, undefined, "*"]
  '([\\/.])?(?:(?:\\:(\\w+)(?:\\(((?:\\\\.|[^()])+)\\))?|\\(((?:\\\\.|[^()])+)\\))([+*?])?|(\\*))'
].join('|'), 'g')

/**
 * Parse a string for the raw tokens.
 *
 * @param  {String} str
 * @return {Array}
 */
function parse (str) {
  var tokens = []
  var key = 0
  var index = 0
  var path = ''
  var res

  while ((res = PATH_REGEXP.exec(str)) != null) {
    var m = res[0]
    var escaped = res[1]
    var offset = res.index
    path += str.slice(index, offset)
    index = offset + m.length

    // Ignore already escaped sequences.
    if (escaped) {
      path += escaped[1]
      continue
    }

    // Push the current path onto the tokens.
    if (path) {
      tokens.push(path)
      path = ''
    }

    var prefix = res[2]
    var name = res[3]
    var capture = res[4]
    var group = res[5]
    var suffix = res[6]
    var asterisk = res[7]

    var repeat = suffix === '+' || suffix === '*'
    var optional = suffix === '?' || suffix === '*'
    var delimiter = prefix || '/'
    var pattern = capture || group || (asterisk ? '.*' : '[^' + delimiter + ']+?')

    tokens.push({
      name: name || key++,
      prefix: prefix || '',
      delimiter: delimiter,
      optional: optional,
      repeat: repeat,
      pattern: escapeGroup(pattern)
    })
  }

  // Match any characters still remaining.
  if (index < str.length) {
    path += str.substr(index)
  }

  // If the path exists, push it onto the end.
  if (path) {
    tokens.push(path)
  }

  return tokens
}

/**
 * Compile a string to a template function for the path.
 *
 * @param  {String}   str
 * @return {Function}
 */
function compile (str) {
  return tokensToFunction(parse(str))
}

/**
 * Expose a method for transforming tokens into the path function.
 */
function tokensToFunction (tokens) {
  // Compile all the tokens into regexps.
  var matches = new Array(tokens.length)

  // Compile all the patterns before compilation.
  for (var i = 0; i < tokens.length; i++) {
    if (typeof tokens[i] === 'object') {
      matches[i] = new RegExp('^' + tokens[i].pattern + '$')
    }
  }

  return function (obj) {
    var path = ''
    var data = obj || {}

    for (var i = 0; i < tokens.length; i++) {
      var token = tokens[i]

      if (typeof token === 'string') {
        path += token

        continue
      }

      var value = data[token.name]
      var segment

      if (value == null) {
        if (token.optional) {
          continue
        } else {
          throw new TypeError('Expected "' + token.name + '" to be defined')
        }
      }

      if (isarray(value)) {
        if (!token.repeat) {
          throw new TypeError('Expected "' + token.name + '" to not repeat, but received "' + value + '"')
        }

        if (value.length === 0) {
          if (token.optional) {
            continue
          } else {
            throw new TypeError('Expected "' + token.name + '" to not be empty')
          }
        }

        for (var j = 0; j < value.length; j++) {
          segment = encodeURIComponent(value[j])

          if (!matches[i].test(segment)) {
            throw new TypeError('Expected all "' + token.name + '" to match "' + token.pattern + '", but received "' + segment + '"')
          }

          path += (j === 0 ? token.prefix : token.delimiter) + segment
        }

        continue
      }

      segment = encodeURIComponent(value)

      if (!matches[i].test(segment)) {
        throw new TypeError('Expected "' + token.name + '" to match "' + token.pattern + '", but received "' + segment + '"')
      }

      path += token.prefix + segment
    }

    return path
  }
}

/**
 * Escape a regular expression string.
 *
 * @param  {String} str
 * @return {String}
 */
function escapeString (str) {
  return str.replace(/([.+*?=^!:${}()[\]|\/])/g, '\\$1')
}

/**
 * Escape the capturing group by escaping special characters and meaning.
 *
 * @param  {String} group
 * @return {String}
 */
function escapeGroup (group) {
  return group.replace(/([=!:$\/()])/g, '\\$1')
}

/**
 * Attach the keys as a property of the regexp.
 *
 * @param  {RegExp} re
 * @param  {Array}  keys
 * @return {RegExp}
 */
function attachKeys (re, keys) {
  re.keys = keys
  return re
}

/**
 * Get the flags for a regexp from the options.
 *
 * @param  {Object} options
 * @return {String}
 */
function flags (options) {
  return options.sensitive ? '' : 'i'
}

/**
 * Pull out keys from a regexp.
 *
 * @param  {RegExp} path
 * @param  {Array}  keys
 * @return {RegExp}
 */
function regexpToRegexp (path, keys) {
  // Use a negative lookahead to match only capturing groups.
  var groups = path.source.match(/\((?!\?)/g)

  if (groups) {
    for (var i = 0; i < groups.length; i++) {
      keys.push({
        name: i,
        prefix: null,
        delimiter: null,
        optional: false,
        repeat: false,
        pattern: null
      })
    }
  }

  return attachKeys(path, keys)
}

/**
 * Transform an array into a regexp.
 *
 * @param  {Array}  path
 * @param  {Array}  keys
 * @param  {Object} options
 * @return {RegExp}
 */
function arrayToRegexp (path, keys, options) {
  var parts = []

  for (var i = 0; i < path.length; i++) {
    parts.push(pathToRegexp(path[i], keys, options).source)
  }

  var regexp = new RegExp('(?:' + parts.join('|') + ')', flags(options))

  return attachKeys(regexp, keys)
}

/**
 * Create a path regexp from string input.
 *
 * @param  {String} path
 * @param  {Array}  keys
 * @param  {Object} options
 * @return {RegExp}
 */
function stringToRegexp (path, keys, options) {
  var tokens = parse(path)
  var re = tokensToRegExp(tokens, options)

  // Attach keys back to the regexp.
  for (var i = 0; i < tokens.length; i++) {
    if (typeof tokens[i] !== 'string') {
      keys.push(tokens[i])
    }
  }

  return attachKeys(re, keys)
}

/**
 * Expose a function for taking tokens and returning a RegExp.
 *
 * @param  {Array}  tokens
 * @param  {Array}  keys
 * @param  {Object} options
 * @return {RegExp}
 */
function tokensToRegExp (tokens, options) {
  options = options || {}

  var strict = options.strict
  var end = options.end !== false
  var route = ''
  var lastToken = tokens[tokens.length - 1]
  var endsWithSlash = typeof lastToken === 'string' && /\/$/.test(lastToken)

  // Iterate over the tokens and create our regexp string.
  for (var i = 0; i < tokens.length; i++) {
    var token = tokens[i]

    if (typeof token === 'string') {
      route += escapeString(token)
    } else {
      var prefix = escapeString(token.prefix)
      var capture = token.pattern

      if (token.repeat) {
        capture += '(?:' + prefix + capture + ')*'
      }

      if (token.optional) {
        if (prefix) {
          capture = '(?:' + prefix + '(' + capture + '))?'
        } else {
          capture = '(' + capture + ')?'
        }
      } else {
        capture = prefix + '(' + capture + ')'
      }

      route += capture
    }
  }

  // In non-strict mode we allow a slash at the end of match. If the path to
  // match already ends with a slash, we remove it for consistency. The slash
  // is valid at the end of a path match, not in the middle. This is important
  // in non-ending mode, where "/test/" shouldn't match "/test//route".
  if (!strict) {
    route = (endsWithSlash ? route.slice(0, -2) : route) + '(?:\\/(?=$))?'
  }

  if (end) {
    route += '$'
  } else {
    // In non-ending mode, we need the capturing groups to match as much as
    // possible by using a positive lookahead to the end or next path segment.
    route += strict && endsWithSlash ? '' : '(?=\\/|$)'
  }

  return new RegExp('^' + route, flags(options))
}

/**
 * Normalize the given path string, returning a regular expression.
 *
 * An empty array can be passed in for the keys, which will hold the
 * placeholder key descriptions. For example, using `/user/:id`, `keys` will
 * contain `[{ name: 'id', delimiter: '/', optional: false, repeat: false }]`.
 *
 * @param  {(String|RegExp|Array)} path
 * @param  {Array}                 [keys]
 * @param  {Object}                [options]
 * @return {RegExp}
 */
function pathToRegexp (path, keys, options) {
  keys = keys || []

  if (!isarray(keys)) {
    options = keys
    keys = []
  } else if (!options) {
    options = {}
  }

  if (path instanceof RegExp) {
    return regexpToRegexp(path, keys, options)
  }

  if (isarray(path)) {
    return arrayToRegexp(path, keys, options)
  }

  return stringToRegexp(path, keys, options)
}

},{"isarray":4}],4:[function(require,module,exports){
module.exports = Array.isArray || function (arr) {
  return Object.prototype.toString.call(arr) == '[object Array]';
};

},{}],5:[function(require,module,exports){
/**
 * Copyright (c) 2011-2014 Felix Gnass
 * Licensed under the MIT license
 * http://spin.js.org/
 *
 * Example:
    var opts = {
      lines: 12             // The number of lines to draw
    , length: 7             // The length of each line
    , width: 5              // The line thickness
    , radius: 10            // The radius of the inner circle
    , scale: 1.0            // Scales overall size of the spinner
    , corners: 1            // Roundness (0..1)
    , color: '#000'         // #rgb or #rrggbb
    , opacity: 1/4          // Opacity of the lines
    , rotate: 0             // Rotation offset
    , direction: 1          // 1: clockwise, -1: counterclockwise
    , speed: 1              // Rounds per second
    , trail: 100            // Afterglow percentage
    , fps: 20               // Frames per second when using setTimeout()
    , zIndex: 2e9           // Use a high z-index by default
    , className: 'spinner'  // CSS class to assign to the element
    , top: '50%'            // center vertically
    , left: '50%'           // center horizontally
    , shadow: false         // Whether to render a shadow
    , hwaccel: false        // Whether to use hardware acceleration (might be buggy)
    , position: 'absolute'  // Element positioning
    }
    var target = document.getElementById('foo')
    var spinner = new Spinner(opts).spin(target)
 */
;(function (root, factory) {

  /* CommonJS */
  if (typeof module == 'object' && module.exports) module.exports = factory()

  /* AMD module */
  else if (typeof define == 'function' && define.amd) define(factory)

  /* Browser global */
  else root.Spinner = factory()
}(this, function () {
  "use strict"

  var prefixes = ['webkit', 'Moz', 'ms', 'O'] /* Vendor prefixes */
    , animations = {} /* Animation rules keyed by their name */
    , useCssAnimations /* Whether to use CSS animations or setTimeout */
    , sheet /* A stylesheet to hold the @keyframe or VML rules. */

  /**
   * Utility function to create elements. If no tag name is given,
   * a DIV is created. Optionally properties can be passed.
   */
  function createEl (tag, prop) {
    var el = document.createElement(tag || 'div')
      , n

    for (n in prop) el[n] = prop[n]
    return el
  }

  /**
   * Appends children and returns the parent.
   */
  function ins (parent /* child1, child2, ...*/) {
    for (var i = 1, n = arguments.length; i < n; i++) {
      parent.appendChild(arguments[i])
    }

    return parent
  }

  /**
   * Creates an opacity keyframe animation rule and returns its name.
   * Since most mobile Webkits have timing issues with animation-delay,
   * we create separate rules for each line/segment.
   */
  function addAnimation (alpha, trail, i, lines) {
    var name = ['opacity', trail, ~~(alpha * 100), i, lines].join('-')
      , start = 0.01 + i/lines * 100
      , z = Math.max(1 - (1-alpha) / trail * (100-start), alpha)
      , prefix = useCssAnimations.substring(0, useCssAnimations.indexOf('Animation')).toLowerCase()
      , pre = prefix && '-' + prefix + '-' || ''

    if (!animations[name]) {
      sheet.insertRule(
        '@' + pre + 'keyframes ' + name + '{' +
        '0%{opacity:' + z + '}' +
        start + '%{opacity:' + alpha + '}' +
        (start+0.01) + '%{opacity:1}' +
        (start+trail) % 100 + '%{opacity:' + alpha + '}' +
        '100%{opacity:' + z + '}' +
        '}', sheet.cssRules.length)

      animations[name] = 1
    }

    return name
  }

  /**
   * Tries various vendor prefixes and returns the first supported property.
   */
  function vendor (el, prop) {
    var s = el.style
      , pp
      , i

    prop = prop.charAt(0).toUpperCase() + prop.slice(1)
    if (s[prop] !== undefined) return prop
    for (i = 0; i < prefixes.length; i++) {
      pp = prefixes[i]+prop
      if (s[pp] !== undefined) return pp
    }
  }

  /**
   * Sets multiple style properties at once.
   */
  function css (el, prop) {
    for (var n in prop) {
      el.style[vendor(el, n) || n] = prop[n]
    }

    return el
  }

  /**
   * Fills in default values.
   */
  function merge (obj) {
    for (var i = 1; i < arguments.length; i++) {
      var def = arguments[i]
      for (var n in def) {
        if (obj[n] === undefined) obj[n] = def[n]
      }
    }
    return obj
  }

  /**
   * Returns the line color from the given string or array.
   */
  function getColor (color, idx) {
    return typeof color == 'string' ? color : color[idx % color.length]
  }

  // Built-in defaults

  var defaults = {
    lines: 12             // The number of lines to draw
  , length: 7             // The length of each line
  , width: 5              // The line thickness
  , radius: 10            // The radius of the inner circle
  , scale: 1.0            // Scales overall size of the spinner
  , corners: 1            // Roundness (0..1)
  , color: '#000'         // #rgb or #rrggbb
  , opacity: 1/4          // Opacity of the lines
  , rotate: 0             // Rotation offset
  , direction: 1          // 1: clockwise, -1: counterclockwise
  , speed: 1              // Rounds per second
  , trail: 100            // Afterglow percentage
  , fps: 20               // Frames per second when using setTimeout()
  , zIndex: 2e9           // Use a high z-index by default
  , className: 'spinner'  // CSS class to assign to the element
  , top: '50%'            // center vertically
  , left: '50%'           // center horizontally
  , shadow: false         // Whether to render a shadow
  , hwaccel: false        // Whether to use hardware acceleration (might be buggy)
  , position: 'absolute'  // Element positioning
  }

  /** The constructor */
  function Spinner (o) {
    this.opts = merge(o || {}, Spinner.defaults, defaults)
  }

  // Global defaults that override the built-ins:
  Spinner.defaults = {}

  merge(Spinner.prototype, {
    /**
     * Adds the spinner to the given target element. If this instance is already
     * spinning, it is automatically removed from its previous target b calling
     * stop() internally.
     */
    spin: function (target) {
      this.stop()

      var self = this
        , o = self.opts
        , el = self.el = createEl(null, {className: o.className})

      css(el, {
        position: o.position
      , width: 0
      , zIndex: o.zIndex
      , left: o.left
      , top: o.top
      })

      if (target) {
        target.insertBefore(el, target.firstChild || null)
      }

      el.setAttribute('role', 'progressbar')
      self.lines(el, self.opts)

      if (!useCssAnimations) {
        // No CSS animation support, use setTimeout() instead
        var i = 0
          , start = (o.lines - 1) * (1 - o.direction) / 2
          , alpha
          , fps = o.fps
          , f = fps / o.speed
          , ostep = (1 - o.opacity) / (f * o.trail / 100)
          , astep = f / o.lines

        ;(function anim () {
          i++
          for (var j = 0; j < o.lines; j++) {
            alpha = Math.max(1 - (i + (o.lines - j) * astep) % f * ostep, o.opacity)

            self.opacity(el, j * o.direction + start, alpha, o)
          }
          self.timeout = self.el && setTimeout(anim, ~~(1000 / fps))
        })()
      }
      return self
    }

    /**
     * Stops and removes the Spinner.
     */
  , stop: function () {
      var el = this.el
      if (el) {
        clearTimeout(this.timeout)
        if (el.parentNode) el.parentNode.removeChild(el)
        this.el = undefined
      }
      return this
    }

    /**
     * Internal method that draws the individual lines. Will be overwritten
     * in VML fallback mode below.
     */
  , lines: function (el, o) {
      var i = 0
        , start = (o.lines - 1) * (1 - o.direction) / 2
        , seg

      function fill (color, shadow) {
        return css(createEl(), {
          position: 'absolute'
        , width: o.scale * (o.length + o.width) + 'px'
        , height: o.scale * o.width + 'px'
        , background: color
        , boxShadow: shadow
        , transformOrigin: 'left'
        , transform: 'rotate(' + ~~(360/o.lines*i + o.rotate) + 'deg) translate(' + o.scale*o.radius + 'px' + ',0)'
        , borderRadius: (o.corners * o.scale * o.width >> 1) + 'px'
        })
      }

      for (; i < o.lines; i++) {
        seg = css(createEl(), {
          position: 'absolute'
        , top: 1 + ~(o.scale * o.width / 2) + 'px'
        , transform: o.hwaccel ? 'translate3d(0,0,0)' : ''
        , opacity: o.opacity
        , animation: useCssAnimations && addAnimation(o.opacity, o.trail, start + i * o.direction, o.lines) + ' ' + 1 / o.speed + 's linear infinite'
        })

        if (o.shadow) ins(seg, css(fill('#000', '0 0 4px #000'), {top: '2px'}))
        ins(el, ins(seg, fill(getColor(o.color, i), '0 0 1px rgba(0,0,0,.1)')))
      }
      return el
    }

    /**
     * Internal method that adjusts the opacity of a single line.
     * Will be overwritten in VML fallback mode below.
     */
  , opacity: function (el, i, val) {
      if (i < el.childNodes.length) el.childNodes[i].style.opacity = val
    }

  })


  function initVML () {

    /* Utility function to create a VML tag */
    function vml (tag, attr) {
      return createEl('<' + tag + ' xmlns="urn:schemas-microsoft.com:vml" class="spin-vml">', attr)
    }

    // No CSS transforms but VML support, add a CSS rule for VML elements:
    sheet.addRule('.spin-vml', 'behavior:url(#default#VML)')

    Spinner.prototype.lines = function (el, o) {
      var r = o.scale * (o.length + o.width)
        , s = o.scale * 2 * r

      function grp () {
        return css(
          vml('group', {
            coordsize: s + ' ' + s
          , coordorigin: -r + ' ' + -r
          })
        , { width: s, height: s }
        )
      }

      var margin = -(o.width + o.length) * o.scale * 2 + 'px'
        , g = css(grp(), {position: 'absolute', top: margin, left: margin})
        , i

      function seg (i, dx, filter) {
        ins(
          g
        , ins(
            css(grp(), {rotation: 360 / o.lines * i + 'deg', left: ~~dx})
          , ins(
              css(
                vml('roundrect', {arcsize: o.corners})
              , { width: r
                , height: o.scale * o.width
                , left: o.scale * o.radius
                , top: -o.scale * o.width >> 1
                , filter: filter
                }
              )
            , vml('fill', {color: getColor(o.color, i), opacity: o.opacity})
            , vml('stroke', {opacity: 0}) // transparent stroke to fix color bleeding upon opacity change
            )
          )
        )
      }

      if (o.shadow)
        for (i = 1; i <= o.lines; i++) {
          seg(i, -2, 'progid:DXImageTransform.Microsoft.Blur(pixelradius=2,makeshadow=1,shadowopacity=.3)')
        }

      for (i = 1; i <= o.lines; i++) seg(i)
      return ins(el, g)
    }

    Spinner.prototype.opacity = function (el, i, val, o) {
      var c = el.firstChild
      o = o.shadow && o.lines || 0
      if (c && i + o < c.childNodes.length) {
        c = c.childNodes[i + o]; c = c && c.firstChild; c = c && c.firstChild
        if (c) c.opacity = val
      }
    }
  }

  if (typeof document !== 'undefined') {
    sheet = (function () {
      var el = createEl('style', {type : 'text/css'})
      ins(document.getElementsByTagName('head')[0], el)
      return el.sheet || el.styleSheet
    }())

    var probe = css(createEl('group'), {behavior: 'url(#default#VML)'})

    if (!vendor(probe, 'transform') && probe.adj) initVML()
    else useCssAnimations = vendor(probe, 'animation')
  }

  return Spinner

}));

},{}],6:[function(require,module,exports){
//     Underscore.js 1.8.3
//     http://underscorejs.org
//     (c) 2009-2015 Jeremy Ashkenas, DocumentCloud and Investigative Reporters & Editors
//     Underscore may be freely distributed under the MIT license.

(function() {

  // Baseline setup
  // --------------

  // Establish the root object, `window` in the browser, or `exports` on the server.
  var root = this;

  // Save the previous value of the `_` variable.
  var previousUnderscore = root._;

  // Save bytes in the minified (but not gzipped) version:
  var ArrayProto = Array.prototype, ObjProto = Object.prototype, FuncProto = Function.prototype;

  // Create quick reference variables for speed access to core prototypes.
  var
    push             = ArrayProto.push,
    slice            = ArrayProto.slice,
    toString         = ObjProto.toString,
    hasOwnProperty   = ObjProto.hasOwnProperty;

  // All **ECMAScript 5** native function implementations that we hope to use
  // are declared here.
  var
    nativeIsArray      = Array.isArray,
    nativeKeys         = Object.keys,
    nativeBind         = FuncProto.bind,
    nativeCreate       = Object.create;

  // Naked function reference for surrogate-prototype-swapping.
  var Ctor = function(){};

  // Create a safe reference to the Underscore object for use below.
  var _ = function(obj) {
    if (obj instanceof _) return obj;
    if (!(this instanceof _)) return new _(obj);
    this._wrapped = obj;
  };

  // Export the Underscore object for **Node.js**, with
  // backwards-compatibility for the old `require()` API. If we're in
  // the browser, add `_` as a global object.
  if (typeof exports !== 'undefined') {
    if (typeof module !== 'undefined' && module.exports) {
      exports = module.exports = _;
    }
    exports._ = _;
  } else {
    root._ = _;
  }

  // Current version.
  _.VERSION = '1.8.3';

  // Internal function that returns an efficient (for current engines) version
  // of the passed-in callback, to be repeatedly applied in other Underscore
  // functions.
  var optimizeCb = function(func, context, argCount) {
    if (context === void 0) return func;
    switch (argCount == null ? 3 : argCount) {
      case 1: return function(value) {
        return func.call(context, value);
      };
      case 2: return function(value, other) {
        return func.call(context, value, other);
      };
      case 3: return function(value, index, collection) {
        return func.call(context, value, index, collection);
      };
      case 4: return function(accumulator, value, index, collection) {
        return func.call(context, accumulator, value, index, collection);
      };
    }
    return function() {
      return func.apply(context, arguments);
    };
  };

  // A mostly-internal function to generate callbacks that can be applied
  // to each element in a collection, returning the desired result — either
  // identity, an arbitrary callback, a property matcher, or a property accessor.
  var cb = function(value, context, argCount) {
    if (value == null) return _.identity;
    if (_.isFunction(value)) return optimizeCb(value, context, argCount);
    if (_.isObject(value)) return _.matcher(value);
    return _.property(value);
  };
  _.iteratee = function(value, context) {
    return cb(value, context, Infinity);
  };

  // An internal function for creating assigner functions.
  var createAssigner = function(keysFunc, undefinedOnly) {
    return function(obj) {
      var length = arguments.length;
      if (length < 2 || obj == null) return obj;
      for (var index = 1; index < length; index++) {
        var source = arguments[index],
            keys = keysFunc(source),
            l = keys.length;
        for (var i = 0; i < l; i++) {
          var key = keys[i];
          if (!undefinedOnly || obj[key] === void 0) obj[key] = source[key];
        }
      }
      return obj;
    };
  };

  // An internal function for creating a new object that inherits from another.
  var baseCreate = function(prototype) {
    if (!_.isObject(prototype)) return {};
    if (nativeCreate) return nativeCreate(prototype);
    Ctor.prototype = prototype;
    var result = new Ctor;
    Ctor.prototype = null;
    return result;
  };

  var property = function(key) {
    return function(obj) {
      return obj == null ? void 0 : obj[key];
    };
  };

  // Helper for collection methods to determine whether a collection
  // should be iterated as an array or as an object
  // Related: http://people.mozilla.org/~jorendorff/es6-draft.html#sec-tolength
  // Avoids a very nasty iOS 8 JIT bug on ARM-64. #2094
  var MAX_ARRAY_INDEX = Math.pow(2, 53) - 1;
  var getLength = property('length');
  var isArrayLike = function(collection) {
    var length = getLength(collection);
    return typeof length == 'number' && length >= 0 && length <= MAX_ARRAY_INDEX;
  };

  // Collection Functions
  // --------------------

  // The cornerstone, an `each` implementation, aka `forEach`.
  // Handles raw objects in addition to array-likes. Treats all
  // sparse array-likes as if they were dense.
  _.each = _.forEach = function(obj, iteratee, context) {
    iteratee = optimizeCb(iteratee, context);
    var i, length;
    if (isArrayLike(obj)) {
      for (i = 0, length = obj.length; i < length; i++) {
        iteratee(obj[i], i, obj);
      }
    } else {
      var keys = _.keys(obj);
      for (i = 0, length = keys.length; i < length; i++) {
        iteratee(obj[keys[i]], keys[i], obj);
      }
    }
    return obj;
  };

  // Return the results of applying the iteratee to each element.
  _.map = _.collect = function(obj, iteratee, context) {
    iteratee = cb(iteratee, context);
    var keys = !isArrayLike(obj) && _.keys(obj),
        length = (keys || obj).length,
        results = Array(length);
    for (var index = 0; index < length; index++) {
      var currentKey = keys ? keys[index] : index;
      results[index] = iteratee(obj[currentKey], currentKey, obj);
    }
    return results;
  };

  // Create a reducing function iterating left or right.
  function createReduce(dir) {
    // Optimized iterator function as using arguments.length
    // in the main function will deoptimize the, see #1991.
    function iterator(obj, iteratee, memo, keys, index, length) {
      for (; index >= 0 && index < length; index += dir) {
        var currentKey = keys ? keys[index] : index;
        memo = iteratee(memo, obj[currentKey], currentKey, obj);
      }
      return memo;
    }

    return function(obj, iteratee, memo, context) {
      iteratee = optimizeCb(iteratee, context, 4);
      var keys = !isArrayLike(obj) && _.keys(obj),
          length = (keys || obj).length,
          index = dir > 0 ? 0 : length - 1;
      // Determine the initial value if none is provided.
      if (arguments.length < 3) {
        memo = obj[keys ? keys[index] : index];
        index += dir;
      }
      return iterator(obj, iteratee, memo, keys, index, length);
    };
  }

  // **Reduce** builds up a single result from a list of values, aka `inject`,
  // or `foldl`.
  _.reduce = _.foldl = _.inject = createReduce(1);

  // The right-associative version of reduce, also known as `foldr`.
  _.reduceRight = _.foldr = createReduce(-1);

  // Return the first value which passes a truth test. Aliased as `detect`.
  _.find = _.detect = function(obj, predicate, context) {
    var key;
    if (isArrayLike(obj)) {
      key = _.findIndex(obj, predicate, context);
    } else {
      key = _.findKey(obj, predicate, context);
    }
    if (key !== void 0 && key !== -1) return obj[key];
  };

  // Return all the elements that pass a truth test.
  // Aliased as `select`.
  _.filter = _.select = function(obj, predicate, context) {
    var results = [];
    predicate = cb(predicate, context);
    _.each(obj, function(value, index, list) {
      if (predicate(value, index, list)) results.push(value);
    });
    return results;
  };

  // Return all the elements for which a truth test fails.
  _.reject = function(obj, predicate, context) {
    return _.filter(obj, _.negate(cb(predicate)), context);
  };

  // Determine whether all of the elements match a truth test.
  // Aliased as `all`.
  _.every = _.all = function(obj, predicate, context) {
    predicate = cb(predicate, context);
    var keys = !isArrayLike(obj) && _.keys(obj),
        length = (keys || obj).length;
    for (var index = 0; index < length; index++) {
      var currentKey = keys ? keys[index] : index;
      if (!predicate(obj[currentKey], currentKey, obj)) return false;
    }
    return true;
  };

  // Determine if at least one element in the object matches a truth test.
  // Aliased as `any`.
  _.some = _.any = function(obj, predicate, context) {
    predicate = cb(predicate, context);
    var keys = !isArrayLike(obj) && _.keys(obj),
        length = (keys || obj).length;
    for (var index = 0; index < length; index++) {
      var currentKey = keys ? keys[index] : index;
      if (predicate(obj[currentKey], currentKey, obj)) return true;
    }
    return false;
  };

  // Determine if the array or object contains a given item (using `===`).
  // Aliased as `includes` and `include`.
  _.contains = _.includes = _.include = function(obj, item, fromIndex, guard) {
    if (!isArrayLike(obj)) obj = _.values(obj);
    if (typeof fromIndex != 'number' || guard) fromIndex = 0;
    return _.indexOf(obj, item, fromIndex) >= 0;
  };

  // Invoke a method (with arguments) on every item in a collection.
  _.invoke = function(obj, method) {
    var args = slice.call(arguments, 2);
    var isFunc = _.isFunction(method);
    return _.map(obj, function(value) {
      var func = isFunc ? method : value[method];
      return func == null ? func : func.apply(value, args);
    });
  };

  // Convenience version of a common use case of `map`: fetching a property.
  _.pluck = function(obj, key) {
    return _.map(obj, _.property(key));
  };

  // Convenience version of a common use case of `filter`: selecting only objects
  // containing specific `key:value` pairs.
  _.where = function(obj, attrs) {
    return _.filter(obj, _.matcher(attrs));
  };

  // Convenience version of a common use case of `find`: getting the first object
  // containing specific `key:value` pairs.
  _.findWhere = function(obj, attrs) {
    return _.find(obj, _.matcher(attrs));
  };

  // Return the maximum element (or element-based computation).
  _.max = function(obj, iteratee, context) {
    var result = -Infinity, lastComputed = -Infinity,
        value, computed;
    if (iteratee == null && obj != null) {
      obj = isArrayLike(obj) ? obj : _.values(obj);
      for (var i = 0, length = obj.length; i < length; i++) {
        value = obj[i];
        if (value > result) {
          result = value;
        }
      }
    } else {
      iteratee = cb(iteratee, context);
      _.each(obj, function(value, index, list) {
        computed = iteratee(value, index, list);
        if (computed > lastComputed || computed === -Infinity && result === -Infinity) {
          result = value;
          lastComputed = computed;
        }
      });
    }
    return result;
  };

  // Return the minimum element (or element-based computation).
  _.min = function(obj, iteratee, context) {
    var result = Infinity, lastComputed = Infinity,
        value, computed;
    if (iteratee == null && obj != null) {
      obj = isArrayLike(obj) ? obj : _.values(obj);
      for (var i = 0, length = obj.length; i < length; i++) {
        value = obj[i];
        if (value < result) {
          result = value;
        }
      }
    } else {
      iteratee = cb(iteratee, context);
      _.each(obj, function(value, index, list) {
        computed = iteratee(value, index, list);
        if (computed < lastComputed || computed === Infinity && result === Infinity) {
          result = value;
          lastComputed = computed;
        }
      });
    }
    return result;
  };

  // Shuffle a collection, using the modern version of the
  // [Fisher-Yates shuffle](http://en.wikipedia.org/wiki/Fisher–Yates_shuffle).
  _.shuffle = function(obj) {
    var set = isArrayLike(obj) ? obj : _.values(obj);
    var length = set.length;
    var shuffled = Array(length);
    for (var index = 0, rand; index < length; index++) {
      rand = _.random(0, index);
      if (rand !== index) shuffled[index] = shuffled[rand];
      shuffled[rand] = set[index];
    }
    return shuffled;
  };

  // Sample **n** random values from a collection.
  // If **n** is not specified, returns a single random element.
  // The internal `guard` argument allows it to work with `map`.
  _.sample = function(obj, n, guard) {
    if (n == null || guard) {
      if (!isArrayLike(obj)) obj = _.values(obj);
      return obj[_.random(obj.length - 1)];
    }
    return _.shuffle(obj).slice(0, Math.max(0, n));
  };

  // Sort the object's values by a criterion produced by an iteratee.
  _.sortBy = function(obj, iteratee, context) {
    iteratee = cb(iteratee, context);
    return _.pluck(_.map(obj, function(value, index, list) {
      return {
        value: value,
        index: index,
        criteria: iteratee(value, index, list)
      };
    }).sort(function(left, right) {
      var a = left.criteria;
      var b = right.criteria;
      if (a !== b) {
        if (a > b || a === void 0) return 1;
        if (a < b || b === void 0) return -1;
      }
      return left.index - right.index;
    }), 'value');
  };

  // An internal function used for aggregate "group by" operations.
  var group = function(behavior) {
    return function(obj, iteratee, context) {
      var result = {};
      iteratee = cb(iteratee, context);
      _.each(obj, function(value, index) {
        var key = iteratee(value, index, obj);
        behavior(result, value, key);
      });
      return result;
    };
  };

  // Groups the object's values by a criterion. Pass either a string attribute
  // to group by, or a function that returns the criterion.
  _.groupBy = group(function(result, value, key) {
    if (_.has(result, key)) result[key].push(value); else result[key] = [value];
  });

  // Indexes the object's values by a criterion, similar to `groupBy`, but for
  // when you know that your index values will be unique.
  _.indexBy = group(function(result, value, key) {
    result[key] = value;
  });

  // Counts instances of an object that group by a certain criterion. Pass
  // either a string attribute to count by, or a function that returns the
  // criterion.
  _.countBy = group(function(result, value, key) {
    if (_.has(result, key)) result[key]++; else result[key] = 1;
  });

  // Safely create a real, live array from anything iterable.
  _.toArray = function(obj) {
    if (!obj) return [];
    if (_.isArray(obj)) return slice.call(obj);
    if (isArrayLike(obj)) return _.map(obj, _.identity);
    return _.values(obj);
  };

  // Return the number of elements in an object.
  _.size = function(obj) {
    if (obj == null) return 0;
    return isArrayLike(obj) ? obj.length : _.keys(obj).length;
  };

  // Split a collection into two arrays: one whose elements all satisfy the given
  // predicate, and one whose elements all do not satisfy the predicate.
  _.partition = function(obj, predicate, context) {
    predicate = cb(predicate, context);
    var pass = [], fail = [];
    _.each(obj, function(value, key, obj) {
      (predicate(value, key, obj) ? pass : fail).push(value);
    });
    return [pass, fail];
  };

  // Array Functions
  // ---------------

  // Get the first element of an array. Passing **n** will return the first N
  // values in the array. Aliased as `head` and `take`. The **guard** check
  // allows it to work with `_.map`.
  _.first = _.head = _.take = function(array, n, guard) {
    if (array == null) return void 0;
    if (n == null || guard) return array[0];
    return _.initial(array, array.length - n);
  };

  // Returns everything but the last entry of the array. Especially useful on
  // the arguments object. Passing **n** will return all the values in
  // the array, excluding the last N.
  _.initial = function(array, n, guard) {
    return slice.call(array, 0, Math.max(0, array.length - (n == null || guard ? 1 : n)));
  };

  // Get the last element of an array. Passing **n** will return the last N
  // values in the array.
  _.last = function(array, n, guard) {
    if (array == null) return void 0;
    if (n == null || guard) return array[array.length - 1];
    return _.rest(array, Math.max(0, array.length - n));
  };

  // Returns everything but the first entry of the array. Aliased as `tail` and `drop`.
  // Especially useful on the arguments object. Passing an **n** will return
  // the rest N values in the array.
  _.rest = _.tail = _.drop = function(array, n, guard) {
    return slice.call(array, n == null || guard ? 1 : n);
  };

  // Trim out all falsy values from an array.
  _.compact = function(array) {
    return _.filter(array, _.identity);
  };

  // Internal implementation of a recursive `flatten` function.
  var flatten = function(input, shallow, strict, startIndex) {
    var output = [], idx = 0;
    for (var i = startIndex || 0, length = getLength(input); i < length; i++) {
      var value = input[i];
      if (isArrayLike(value) && (_.isArray(value) || _.isArguments(value))) {
        //flatten current level of array or arguments object
        if (!shallow) value = flatten(value, shallow, strict);
        var j = 0, len = value.length;
        output.length += len;
        while (j < len) {
          output[idx++] = value[j++];
        }
      } else if (!strict) {
        output[idx++] = value;
      }
    }
    return output;
  };

  // Flatten out an array, either recursively (by default), or just one level.
  _.flatten = function(array, shallow) {
    return flatten(array, shallow, false);
  };

  // Return a version of the array that does not contain the specified value(s).
  _.without = function(array) {
    return _.difference(array, slice.call(arguments, 1));
  };

  // Produce a duplicate-free version of the array. If the array has already
  // been sorted, you have the option of using a faster algorithm.
  // Aliased as `unique`.
  _.uniq = _.unique = function(array, isSorted, iteratee, context) {
    if (!_.isBoolean(isSorted)) {
      context = iteratee;
      iteratee = isSorted;
      isSorted = false;
    }
    if (iteratee != null) iteratee = cb(iteratee, context);
    var result = [];
    var seen = [];
    for (var i = 0, length = getLength(array); i < length; i++) {
      var value = array[i],
          computed = iteratee ? iteratee(value, i, array) : value;
      if (isSorted) {
        if (!i || seen !== computed) result.push(value);
        seen = computed;
      } else if (iteratee) {
        if (!_.contains(seen, computed)) {
          seen.push(computed);
          result.push(value);
        }
      } else if (!_.contains(result, value)) {
        result.push(value);
      }
    }
    return result;
  };

  // Produce an array that contains the union: each distinct element from all of
  // the passed-in arrays.
  _.union = function() {
    return _.uniq(flatten(arguments, true, true));
  };

  // Produce an array that contains every item shared between all the
  // passed-in arrays.
  _.intersection = function(array) {
    var result = [];
    var argsLength = arguments.length;
    for (var i = 0, length = getLength(array); i < length; i++) {
      var item = array[i];
      if (_.contains(result, item)) continue;
      for (var j = 1; j < argsLength; j++) {
        if (!_.contains(arguments[j], item)) break;
      }
      if (j === argsLength) result.push(item);
    }
    return result;
  };

  // Take the difference between one array and a number of other arrays.
  // Only the elements present in just the first array will remain.
  _.difference = function(array) {
    var rest = flatten(arguments, true, true, 1);
    return _.filter(array, function(value){
      return !_.contains(rest, value);
    });
  };

  // Zip together multiple lists into a single array -- elements that share
  // an index go together.
  _.zip = function() {
    return _.unzip(arguments);
  };

  // Complement of _.zip. Unzip accepts an array of arrays and groups
  // each array's elements on shared indices
  _.unzip = function(array) {
    var length = array && _.max(array, getLength).length || 0;
    var result = Array(length);

    for (var index = 0; index < length; index++) {
      result[index] = _.pluck(array, index);
    }
    return result;
  };

  // Converts lists into objects. Pass either a single array of `[key, value]`
  // pairs, or two parallel arrays of the same length -- one of keys, and one of
  // the corresponding values.
  _.object = function(list, values) {
    var result = {};
    for (var i = 0, length = getLength(list); i < length; i++) {
      if (values) {
        result[list[i]] = values[i];
      } else {
        result[list[i][0]] = list[i][1];
      }
    }
    return result;
  };

  // Generator function to create the findIndex and findLastIndex functions
  function createPredicateIndexFinder(dir) {
    return function(array, predicate, context) {
      predicate = cb(predicate, context);
      var length = getLength(array);
      var index = dir > 0 ? 0 : length - 1;
      for (; index >= 0 && index < length; index += dir) {
        if (predicate(array[index], index, array)) return index;
      }
      return -1;
    };
  }

  // Returns the first index on an array-like that passes a predicate test
  _.findIndex = createPredicateIndexFinder(1);
  _.findLastIndex = createPredicateIndexFinder(-1);

  // Use a comparator function to figure out the smallest index at which
  // an object should be inserted so as to maintain order. Uses binary search.
  _.sortedIndex = function(array, obj, iteratee, context) {
    iteratee = cb(iteratee, context, 1);
    var value = iteratee(obj);
    var low = 0, high = getLength(array);
    while (low < high) {
      var mid = Math.floor((low + high) / 2);
      if (iteratee(array[mid]) < value) low = mid + 1; else high = mid;
    }
    return low;
  };

  // Generator function to create the indexOf and lastIndexOf functions
  function createIndexFinder(dir, predicateFind, sortedIndex) {
    return function(array, item, idx) {
      var i = 0, length = getLength(array);
      if (typeof idx == 'number') {
        if (dir > 0) {
            i = idx >= 0 ? idx : Math.max(idx + length, i);
        } else {
            length = idx >= 0 ? Math.min(idx + 1, length) : idx + length + 1;
        }
      } else if (sortedIndex && idx && length) {
        idx = sortedIndex(array, item);
        return array[idx] === item ? idx : -1;
      }
      if (item !== item) {
        idx = predicateFind(slice.call(array, i, length), _.isNaN);
        return idx >= 0 ? idx + i : -1;
      }
      for (idx = dir > 0 ? i : length - 1; idx >= 0 && idx < length; idx += dir) {
        if (array[idx] === item) return idx;
      }
      return -1;
    };
  }

  // Return the position of the first occurrence of an item in an array,
  // or -1 if the item is not included in the array.
  // If the array is large and already in sort order, pass `true`
  // for **isSorted** to use binary search.
  _.indexOf = createIndexFinder(1, _.findIndex, _.sortedIndex);
  _.lastIndexOf = createIndexFinder(-1, _.findLastIndex);

  // Generate an integer Array containing an arithmetic progression. A port of
  // the native Python `range()` function. See
  // [the Python documentation](http://docs.python.org/library/functions.html#range).
  _.range = function(start, stop, step) {
    if (stop == null) {
      stop = start || 0;
      start = 0;
    }
    step = step || 1;

    var length = Math.max(Math.ceil((stop - start) / step), 0);
    var range = Array(length);

    for (var idx = 0; idx < length; idx++, start += step) {
      range[idx] = start;
    }

    return range;
  };

  // Function (ahem) Functions
  // ------------------

  // Determines whether to execute a function as a constructor
  // or a normal function with the provided arguments
  var executeBound = function(sourceFunc, boundFunc, context, callingContext, args) {
    if (!(callingContext instanceof boundFunc)) return sourceFunc.apply(context, args);
    var self = baseCreate(sourceFunc.prototype);
    var result = sourceFunc.apply(self, args);
    if (_.isObject(result)) return result;
    return self;
  };

  // Create a function bound to a given object (assigning `this`, and arguments,
  // optionally). Delegates to **ECMAScript 5**'s native `Function.bind` if
  // available.
  _.bind = function(func, context) {
    if (nativeBind && func.bind === nativeBind) return nativeBind.apply(func, slice.call(arguments, 1));
    if (!_.isFunction(func)) throw new TypeError('Bind must be called on a function');
    var args = slice.call(arguments, 2);
    var bound = function() {
      return executeBound(func, bound, context, this, args.concat(slice.call(arguments)));
    };
    return bound;
  };

  // Partially apply a function by creating a version that has had some of its
  // arguments pre-filled, without changing its dynamic `this` context. _ acts
  // as a placeholder, allowing any combination of arguments to be pre-filled.
  _.partial = function(func) {
    var boundArgs = slice.call(arguments, 1);
    var bound = function() {
      var position = 0, length = boundArgs.length;
      var args = Array(length);
      for (var i = 0; i < length; i++) {
        args[i] = boundArgs[i] === _ ? arguments[position++] : boundArgs[i];
      }
      while (position < arguments.length) args.push(arguments[position++]);
      return executeBound(func, bound, this, this, args);
    };
    return bound;
  };

  // Bind a number of an object's methods to that object. Remaining arguments
  // are the method names to be bound. Useful for ensuring that all callbacks
  // defined on an object belong to it.
  _.bindAll = function(obj) {
    var i, length = arguments.length, key;
    if (length <= 1) throw new Error('bindAll must be passed function names');
    for (i = 1; i < length; i++) {
      key = arguments[i];
      obj[key] = _.bind(obj[key], obj);
    }
    return obj;
  };

  // Memoize an expensive function by storing its results.
  _.memoize = function(func, hasher) {
    var memoize = function(key) {
      var cache = memoize.cache;
      var address = '' + (hasher ? hasher.apply(this, arguments) : key);
      if (!_.has(cache, address)) cache[address] = func.apply(this, arguments);
      return cache[address];
    };
    memoize.cache = {};
    return memoize;
  };

  // Delays a function for the given number of milliseconds, and then calls
  // it with the arguments supplied.
  _.delay = function(func, wait) {
    var args = slice.call(arguments, 2);
    return setTimeout(function(){
      return func.apply(null, args);
    }, wait);
  };

  // Defers a function, scheduling it to run after the current call stack has
  // cleared.
  _.defer = _.partial(_.delay, _, 1);

  // Returns a function, that, when invoked, will only be triggered at most once
  // during a given window of time. Normally, the throttled function will run
  // as much as it can, without ever going more than once per `wait` duration;
  // but if you'd like to disable the execution on the leading edge, pass
  // `{leading: false}`. To disable execution on the trailing edge, ditto.
  _.throttle = function(func, wait, options) {
    var context, args, result;
    var timeout = null;
    var previous = 0;
    if (!options) options = {};
    var later = function() {
      previous = options.leading === false ? 0 : _.now();
      timeout = null;
      result = func.apply(context, args);
      if (!timeout) context = args = null;
    };
    return function() {
      var now = _.now();
      if (!previous && options.leading === false) previous = now;
      var remaining = wait - (now - previous);
      context = this;
      args = arguments;
      if (remaining <= 0 || remaining > wait) {
        if (timeout) {
          clearTimeout(timeout);
          timeout = null;
        }
        previous = now;
        result = func.apply(context, args);
        if (!timeout) context = args = null;
      } else if (!timeout && options.trailing !== false) {
        timeout = setTimeout(later, remaining);
      }
      return result;
    };
  };

  // Returns a function, that, as long as it continues to be invoked, will not
  // be triggered. The function will be called after it stops being called for
  // N milliseconds. If `immediate` is passed, trigger the function on the
  // leading edge, instead of the trailing.
  _.debounce = function(func, wait, immediate) {
    var timeout, args, context, timestamp, result;

    var later = function() {
      var last = _.now() - timestamp;

      if (last < wait && last >= 0) {
        timeout = setTimeout(later, wait - last);
      } else {
        timeout = null;
        if (!immediate) {
          result = func.apply(context, args);
          if (!timeout) context = args = null;
        }
      }
    };

    return function() {
      context = this;
      args = arguments;
      timestamp = _.now();
      var callNow = immediate && !timeout;
      if (!timeout) timeout = setTimeout(later, wait);
      if (callNow) {
        result = func.apply(context, args);
        context = args = null;
      }

      return result;
    };
  };

  // Returns the first function passed as an argument to the second,
  // allowing you to adjust arguments, run code before and after, and
  // conditionally execute the original function.
  _.wrap = function(func, wrapper) {
    return _.partial(wrapper, func);
  };

  // Returns a negated version of the passed-in predicate.
  _.negate = function(predicate) {
    return function() {
      return !predicate.apply(this, arguments);
    };
  };

  // Returns a function that is the composition of a list of functions, each
  // consuming the return value of the function that follows.
  _.compose = function() {
    var args = arguments;
    var start = args.length - 1;
    return function() {
      var i = start;
      var result = args[start].apply(this, arguments);
      while (i--) result = args[i].call(this, result);
      return result;
    };
  };

  // Returns a function that will only be executed on and after the Nth call.
  _.after = function(times, func) {
    return function() {
      if (--times < 1) {
        return func.apply(this, arguments);
      }
    };
  };

  // Returns a function that will only be executed up to (but not including) the Nth call.
  _.before = function(times, func) {
    var memo;
    return function() {
      if (--times > 0) {
        memo = func.apply(this, arguments);
      }
      if (times <= 1) func = null;
      return memo;
    };
  };

  // Returns a function that will be executed at most one time, no matter how
  // often you call it. Useful for lazy initialization.
  _.once = _.partial(_.before, 2);

  // Object Functions
  // ----------------

  // Keys in IE < 9 that won't be iterated by `for key in ...` and thus missed.
  var hasEnumBug = !{toString: null}.propertyIsEnumerable('toString');
  var nonEnumerableProps = ['valueOf', 'isPrototypeOf', 'toString',
                      'propertyIsEnumerable', 'hasOwnProperty', 'toLocaleString'];

  function collectNonEnumProps(obj, keys) {
    var nonEnumIdx = nonEnumerableProps.length;
    var constructor = obj.constructor;
    var proto = (_.isFunction(constructor) && constructor.prototype) || ObjProto;

    // Constructor is a special case.
    var prop = 'constructor';
    if (_.has(obj, prop) && !_.contains(keys, prop)) keys.push(prop);

    while (nonEnumIdx--) {
      prop = nonEnumerableProps[nonEnumIdx];
      if (prop in obj && obj[prop] !== proto[prop] && !_.contains(keys, prop)) {
        keys.push(prop);
      }
    }
  }

  // Retrieve the names of an object's own properties.
  // Delegates to **ECMAScript 5**'s native `Object.keys`
  _.keys = function(obj) {
    if (!_.isObject(obj)) return [];
    if (nativeKeys) return nativeKeys(obj);
    var keys = [];
    for (var key in obj) if (_.has(obj, key)) keys.push(key);
    // Ahem, IE < 9.
    if (hasEnumBug) collectNonEnumProps(obj, keys);
    return keys;
  };

  // Retrieve all the property names of an object.
  _.allKeys = function(obj) {
    if (!_.isObject(obj)) return [];
    var keys = [];
    for (var key in obj) keys.push(key);
    // Ahem, IE < 9.
    if (hasEnumBug) collectNonEnumProps(obj, keys);
    return keys;
  };

  // Retrieve the values of an object's properties.
  _.values = function(obj) {
    var keys = _.keys(obj);
    var length = keys.length;
    var values = Array(length);
    for (var i = 0; i < length; i++) {
      values[i] = obj[keys[i]];
    }
    return values;
  };

  // Returns the results of applying the iteratee to each element of the object
  // In contrast to _.map it returns an object
  _.mapObject = function(obj, iteratee, context) {
    iteratee = cb(iteratee, context);
    var keys =  _.keys(obj),
          length = keys.length,
          results = {},
          currentKey;
      for (var index = 0; index < length; index++) {
        currentKey = keys[index];
        results[currentKey] = iteratee(obj[currentKey], currentKey, obj);
      }
      return results;
  };

  // Convert an object into a list of `[key, value]` pairs.
  _.pairs = function(obj) {
    var keys = _.keys(obj);
    var length = keys.length;
    var pairs = Array(length);
    for (var i = 0; i < length; i++) {
      pairs[i] = [keys[i], obj[keys[i]]];
    }
    return pairs;
  };

  // Invert the keys and values of an object. The values must be serializable.
  _.invert = function(obj) {
    var result = {};
    var keys = _.keys(obj);
    for (var i = 0, length = keys.length; i < length; i++) {
      result[obj[keys[i]]] = keys[i];
    }
    return result;
  };

  // Return a sorted list of the function names available on the object.
  // Aliased as `methods`
  _.functions = _.methods = function(obj) {
    var names = [];
    for (var key in obj) {
      if (_.isFunction(obj[key])) names.push(key);
    }
    return names.sort();
  };

  // Extend a given object with all the properties in passed-in object(s).
  _.extend = createAssigner(_.allKeys);

  // Assigns a given object with all the own properties in the passed-in object(s)
  // (https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Object/assign)
  _.extendOwn = _.assign = createAssigner(_.keys);

  // Returns the first key on an object that passes a predicate test
  _.findKey = function(obj, predicate, context) {
    predicate = cb(predicate, context);
    var keys = _.keys(obj), key;
    for (var i = 0, length = keys.length; i < length; i++) {
      key = keys[i];
      if (predicate(obj[key], key, obj)) return key;
    }
  };

  // Return a copy of the object only containing the whitelisted properties.
  _.pick = function(object, oiteratee, context) {
    var result = {}, obj = object, iteratee, keys;
    if (obj == null) return result;
    if (_.isFunction(oiteratee)) {
      keys = _.allKeys(obj);
      iteratee = optimizeCb(oiteratee, context);
    } else {
      keys = flatten(arguments, false, false, 1);
      iteratee = function(value, key, obj) { return key in obj; };
      obj = Object(obj);
    }
    for (var i = 0, length = keys.length; i < length; i++) {
      var key = keys[i];
      var value = obj[key];
      if (iteratee(value, key, obj)) result[key] = value;
    }
    return result;
  };

   // Return a copy of the object without the blacklisted properties.
  _.omit = function(obj, iteratee, context) {
    if (_.isFunction(iteratee)) {
      iteratee = _.negate(iteratee);
    } else {
      var keys = _.map(flatten(arguments, false, false, 1), String);
      iteratee = function(value, key) {
        return !_.contains(keys, key);
      };
    }
    return _.pick(obj, iteratee, context);
  };

  // Fill in a given object with default properties.
  _.defaults = createAssigner(_.allKeys, true);

  // Creates an object that inherits from the given prototype object.
  // If additional properties are provided then they will be added to the
  // created object.
  _.create = function(prototype, props) {
    var result = baseCreate(prototype);
    if (props) _.extendOwn(result, props);
    return result;
  };

  // Create a (shallow-cloned) duplicate of an object.
  _.clone = function(obj) {
    if (!_.isObject(obj)) return obj;
    return _.isArray(obj) ? obj.slice() : _.extend({}, obj);
  };

  // Invokes interceptor with the obj, and then returns obj.
  // The primary purpose of this method is to "tap into" a method chain, in
  // order to perform operations on intermediate results within the chain.
  _.tap = function(obj, interceptor) {
    interceptor(obj);
    return obj;
  };

  // Returns whether an object has a given set of `key:value` pairs.
  _.isMatch = function(object, attrs) {
    var keys = _.keys(attrs), length = keys.length;
    if (object == null) return !length;
    var obj = Object(object);
    for (var i = 0; i < length; i++) {
      var key = keys[i];
      if (attrs[key] !== obj[key] || !(key in obj)) return false;
    }
    return true;
  };


  // Internal recursive comparison function for `isEqual`.
  var eq = function(a, b, aStack, bStack) {
    // Identical objects are equal. `0 === -0`, but they aren't identical.
    // See the [Harmony `egal` proposal](http://wiki.ecmascript.org/doku.php?id=harmony:egal).
    if (a === b) return a !== 0 || 1 / a === 1 / b;
    // A strict comparison is necessary because `null == undefined`.
    if (a == null || b == null) return a === b;
    // Unwrap any wrapped objects.
    if (a instanceof _) a = a._wrapped;
    if (b instanceof _) b = b._wrapped;
    // Compare `[[Class]]` names.
    var className = toString.call(a);
    if (className !== toString.call(b)) return false;
    switch (className) {
      // Strings, numbers, regular expressions, dates, and booleans are compared by value.
      case '[object RegExp]':
      // RegExps are coerced to strings for comparison (Note: '' + /a/i === '/a/i')
      case '[object String]':
        // Primitives and their corresponding object wrappers are equivalent; thus, `"5"` is
        // equivalent to `new String("5")`.
        return '' + a === '' + b;
      case '[object Number]':
        // `NaN`s are equivalent, but non-reflexive.
        // Object(NaN) is equivalent to NaN
        if (+a !== +a) return +b !== +b;
        // An `egal` comparison is performed for other numeric values.
        return +a === 0 ? 1 / +a === 1 / b : +a === +b;
      case '[object Date]':
      case '[object Boolean]':
        // Coerce dates and booleans to numeric primitive values. Dates are compared by their
        // millisecond representations. Note that invalid dates with millisecond representations
        // of `NaN` are not equivalent.
        return +a === +b;
    }

    var areArrays = className === '[object Array]';
    if (!areArrays) {
      if (typeof a != 'object' || typeof b != 'object') return false;

      // Objects with different constructors are not equivalent, but `Object`s or `Array`s
      // from different frames are.
      var aCtor = a.constructor, bCtor = b.constructor;
      if (aCtor !== bCtor && !(_.isFunction(aCtor) && aCtor instanceof aCtor &&
                               _.isFunction(bCtor) && bCtor instanceof bCtor)
                          && ('constructor' in a && 'constructor' in b)) {
        return false;
      }
    }
    // Assume equality for cyclic structures. The algorithm for detecting cyclic
    // structures is adapted from ES 5.1 section 15.12.3, abstract operation `JO`.

    // Initializing stack of traversed objects.
    // It's done here since we only need them for objects and arrays comparison.
    aStack = aStack || [];
    bStack = bStack || [];
    var length = aStack.length;
    while (length--) {
      // Linear search. Performance is inversely proportional to the number of
      // unique nested structures.
      if (aStack[length] === a) return bStack[length] === b;
    }

    // Add the first object to the stack of traversed objects.
    aStack.push(a);
    bStack.push(b);

    // Recursively compare objects and arrays.
    if (areArrays) {
      // Compare array lengths to determine if a deep comparison is necessary.
      length = a.length;
      if (length !== b.length) return false;
      // Deep compare the contents, ignoring non-numeric properties.
      while (length--) {
        if (!eq(a[length], b[length], aStack, bStack)) return false;
      }
    } else {
      // Deep compare objects.
      var keys = _.keys(a), key;
      length = keys.length;
      // Ensure that both objects contain the same number of properties before comparing deep equality.
      if (_.keys(b).length !== length) return false;
      while (length--) {
        // Deep compare each member
        key = keys[length];
        if (!(_.has(b, key) && eq(a[key], b[key], aStack, bStack))) return false;
      }
    }
    // Remove the first object from the stack of traversed objects.
    aStack.pop();
    bStack.pop();
    return true;
  };

  // Perform a deep comparison to check if two objects are equal.
  _.isEqual = function(a, b) {
    return eq(a, b);
  };

  // Is a given array, string, or object empty?
  // An "empty" object has no enumerable own-properties.
  _.isEmpty = function(obj) {
    if (obj == null) return true;
    if (isArrayLike(obj) && (_.isArray(obj) || _.isString(obj) || _.isArguments(obj))) return obj.length === 0;
    return _.keys(obj).length === 0;
  };

  // Is a given value a DOM element?
  _.isElement = function(obj) {
    return !!(obj && obj.nodeType === 1);
  };

  // Is a given value an array?
  // Delegates to ECMA5's native Array.isArray
  _.isArray = nativeIsArray || function(obj) {
    return toString.call(obj) === '[object Array]';
  };

  // Is a given variable an object?
  _.isObject = function(obj) {
    var type = typeof obj;
    return type === 'function' || type === 'object' && !!obj;
  };

  // Add some isType methods: isArguments, isFunction, isString, isNumber, isDate, isRegExp, isError.
  _.each(['Arguments', 'Function', 'String', 'Number', 'Date', 'RegExp', 'Error'], function(name) {
    _['is' + name] = function(obj) {
      return toString.call(obj) === '[object ' + name + ']';
    };
  });

  // Define a fallback version of the method in browsers (ahem, IE < 9), where
  // there isn't any inspectable "Arguments" type.
  if (!_.isArguments(arguments)) {
    _.isArguments = function(obj) {
      return _.has(obj, 'callee');
    };
  }

  // Optimize `isFunction` if appropriate. Work around some typeof bugs in old v8,
  // IE 11 (#1621), and in Safari 8 (#1929).
  if (typeof /./ != 'function' && typeof Int8Array != 'object') {
    _.isFunction = function(obj) {
      return typeof obj == 'function' || false;
    };
  }

  // Is a given object a finite number?
  _.isFinite = function(obj) {
    return isFinite(obj) && !isNaN(parseFloat(obj));
  };

  // Is the given value `NaN`? (NaN is the only number which does not equal itself).
  _.isNaN = function(obj) {
    return _.isNumber(obj) && obj !== +obj;
  };

  // Is a given value a boolean?
  _.isBoolean = function(obj) {
    return obj === true || obj === false || toString.call(obj) === '[object Boolean]';
  };

  // Is a given value equal to null?
  _.isNull = function(obj) {
    return obj === null;
  };

  // Is a given variable undefined?
  _.isUndefined = function(obj) {
    return obj === void 0;
  };

  // Shortcut function for checking if an object has a given property directly
  // on itself (in other words, not on a prototype).
  _.has = function(obj, key) {
    return obj != null && hasOwnProperty.call(obj, key);
  };

  // Utility Functions
  // -----------------

  // Run Underscore.js in *noConflict* mode, returning the `_` variable to its
  // previous owner. Returns a reference to the Underscore object.
  _.noConflict = function() {
    root._ = previousUnderscore;
    return this;
  };

  // Keep the identity function around for default iteratees.
  _.identity = function(value) {
    return value;
  };

  // Predicate-generating functions. Often useful outside of Underscore.
  _.constant = function(value) {
    return function() {
      return value;
    };
  };

  _.noop = function(){};

  _.property = property;

  // Generates a function for a given object that returns a given property.
  _.propertyOf = function(obj) {
    return obj == null ? function(){} : function(key) {
      return obj[key];
    };
  };

  // Returns a predicate for checking whether an object has a given set of
  // `key:value` pairs.
  _.matcher = _.matches = function(attrs) {
    attrs = _.extendOwn({}, attrs);
    return function(obj) {
      return _.isMatch(obj, attrs);
    };
  };

  // Run a function **n** times.
  _.times = function(n, iteratee, context) {
    var accum = Array(Math.max(0, n));
    iteratee = optimizeCb(iteratee, context, 1);
    for (var i = 0; i < n; i++) accum[i] = iteratee(i);
    return accum;
  };

  // Return a random integer between min and max (inclusive).
  _.random = function(min, max) {
    if (max == null) {
      max = min;
      min = 0;
    }
    return min + Math.floor(Math.random() * (max - min + 1));
  };

  // A (possibly faster) way to get the current timestamp as an integer.
  _.now = Date.now || function() {
    return new Date().getTime();
  };

   // List of HTML entities for escaping.
  var escapeMap = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#x27;',
    '`': '&#x60;'
  };
  var unescapeMap = _.invert(escapeMap);

  // Functions for escaping and unescaping strings to/from HTML interpolation.
  var createEscaper = function(map) {
    var escaper = function(match) {
      return map[match];
    };
    // Regexes for identifying a key that needs to be escaped
    var source = '(?:' + _.keys(map).join('|') + ')';
    var testRegexp = RegExp(source);
    var replaceRegexp = RegExp(source, 'g');
    return function(string) {
      string = string == null ? '' : '' + string;
      return testRegexp.test(string) ? string.replace(replaceRegexp, escaper) : string;
    };
  };
  _.escape = createEscaper(escapeMap);
  _.unescape = createEscaper(unescapeMap);

  // If the value of the named `property` is a function then invoke it with the
  // `object` as context; otherwise, return it.
  _.result = function(object, property, fallback) {
    var value = object == null ? void 0 : object[property];
    if (value === void 0) {
      value = fallback;
    }
    return _.isFunction(value) ? value.call(object) : value;
  };

  // Generate a unique integer id (unique within the entire client session).
  // Useful for temporary DOM ids.
  var idCounter = 0;
  _.uniqueId = function(prefix) {
    var id = ++idCounter + '';
    return prefix ? prefix + id : id;
  };

  // By default, Underscore uses ERB-style template delimiters, change the
  // following template settings to use alternative delimiters.
  _.templateSettings = {
    evaluate    : /<%([\s\S]+?)%>/g,
    interpolate : /<%=([\s\S]+?)%>/g,
    escape      : /<%-([\s\S]+?)%>/g
  };

  // When customizing `templateSettings`, if you don't want to define an
  // interpolation, evaluation or escaping regex, we need one that is
  // guaranteed not to match.
  var noMatch = /(.)^/;

  // Certain characters need to be escaped so that they can be put into a
  // string literal.
  var escapes = {
    "'":      "'",
    '\\':     '\\',
    '\r':     'r',
    '\n':     'n',
    '\u2028': 'u2028',
    '\u2029': 'u2029'
  };

  var escaper = /\\|'|\r|\n|\u2028|\u2029/g;

  var escapeChar = function(match) {
    return '\\' + escapes[match];
  };

  // JavaScript micro-templating, similar to John Resig's implementation.
  // Underscore templating handles arbitrary delimiters, preserves whitespace,
  // and correctly escapes quotes within interpolated code.
  // NB: `oldSettings` only exists for backwards compatibility.
  _.template = function(text, settings, oldSettings) {
    if (!settings && oldSettings) settings = oldSettings;
    settings = _.defaults({}, settings, _.templateSettings);

    // Combine delimiters into one regular expression via alternation.
    var matcher = RegExp([
      (settings.escape || noMatch).source,
      (settings.interpolate || noMatch).source,
      (settings.evaluate || noMatch).source
    ].join('|') + '|$', 'g');

    // Compile the template source, escaping string literals appropriately.
    var index = 0;
    var source = "__p+='";
    text.replace(matcher, function(match, escape, interpolate, evaluate, offset) {
      source += text.slice(index, offset).replace(escaper, escapeChar);
      index = offset + match.length;

      if (escape) {
        source += "'+\n((__t=(" + escape + "))==null?'':_.escape(__t))+\n'";
      } else if (interpolate) {
        source += "'+\n((__t=(" + interpolate + "))==null?'':__t)+\n'";
      } else if (evaluate) {
        source += "';\n" + evaluate + "\n__p+='";
      }

      // Adobe VMs need the match returned to produce the correct offest.
      return match;
    });
    source += "';\n";

    // If a variable is not specified, place data values in local scope.
    if (!settings.variable) source = 'with(obj||{}){\n' + source + '}\n';

    source = "var __t,__p='',__j=Array.prototype.join," +
      "print=function(){__p+=__j.call(arguments,'');};\n" +
      source + 'return __p;\n';

    try {
      var render = new Function(settings.variable || 'obj', '_', source);
    } catch (e) {
      e.source = source;
      throw e;
    }

    var template = function(data) {
      return render.call(this, data, _);
    };

    // Provide the compiled source as a convenience for precompilation.
    var argument = settings.variable || 'obj';
    template.source = 'function(' + argument + '){\n' + source + '}';

    return template;
  };

  // Add a "chain" function. Start chaining a wrapped Underscore object.
  _.chain = function(obj) {
    var instance = _(obj);
    instance._chain = true;
    return instance;
  };

  // OOP
  // ---------------
  // If Underscore is called as a function, it returns a wrapped object that
  // can be used OO-style. This wrapper holds altered versions of all the
  // underscore functions. Wrapped objects may be chained.

  // Helper function to continue chaining intermediate results.
  var result = function(instance, obj) {
    return instance._chain ? _(obj).chain() : obj;
  };

  // Add your own custom functions to the Underscore object.
  _.mixin = function(obj) {
    _.each(_.functions(obj), function(name) {
      var func = _[name] = obj[name];
      _.prototype[name] = function() {
        var args = [this._wrapped];
        push.apply(args, arguments);
        return result(this, func.apply(_, args));
      };
    });
  };

  // Add all of the Underscore functions to the wrapper object.
  _.mixin(_);

  // Add all mutator Array functions to the wrapper.
  _.each(['pop', 'push', 'reverse', 'shift', 'sort', 'splice', 'unshift'], function(name) {
    var method = ArrayProto[name];
    _.prototype[name] = function() {
      var obj = this._wrapped;
      method.apply(obj, arguments);
      if ((name === 'shift' || name === 'splice') && obj.length === 0) delete obj[0];
      return result(this, obj);
    };
  });

  // Add all accessor Array functions to the wrapper.
  _.each(['concat', 'join', 'slice'], function(name) {
    var method = ArrayProto[name];
    _.prototype[name] = function() {
      return result(this, method.apply(this._wrapped, arguments));
    };
  });

  // Extracts the result from a wrapped and chained object.
  _.prototype.value = function() {
    return this._wrapped;
  };

  // Provide unwrapping proxy for some methods used in engine operations
  // such as arithmetic and JSON stringification.
  _.prototype.valueOf = _.prototype.toJSON = _.prototype.value;

  _.prototype.toString = function() {
    return '' + this._wrapped;
  };

  // AMD registration happens at the end for compatibility with AMD loaders
  // that may not enforce next-turn semantics on modules. Even though general
  // practice for AMD registration is to be anonymous, underscore registers
  // as a named module because, like jQuery, it is a base library that is
  // popular enough to be bundled in a third party lib, but not be part of
  // an AMD load request. Those cases could generate an error when an
  // anonymous define() is called outside of a loader request.
  if (typeof define === 'function' && define.amd) {
    define('underscore', [], function() {
      return _;
    });
  }
}.call(this));

},{}],7:[function(require,module,exports){
var editable = require("make-editable");
var pubsub = require("pubsub");
var debounce = require("debounce-fn");
var classes = require("dom-classes");

var counter = 1;

module.exports = create;

function create (textarea) {
  var iframe = replace(textarea);
  var api = editable(iframe.contentWindow.document);

  api.iframe = iframe;
  api.onUpdate = pubsub();
  api.read = read;

  watch(api, function () {
    textarea.value = read();
    api.onUpdate.publish();
  });

  return api;

  function read () {
    return iframe.contentWindow.document.body.innerHTML;
  };
}

function replace (textarea) {
  var id = counter++;
  var iframe = document.createElement('iframe');
  iframe.setAttribute('class', 'wysiwyg wysiwyg-' + id);

  textarea.style.display = 'none';
  textarea.parentNode.insertBefore(iframe, textarea);

  iframe.contentWindow.document.body.innerHTML = textarea.value;

  iframe.contentWindow.addEventListener('focus', function () {
    classes.add(iframe, 'focus');
  }, false);

  iframe.contentWindow.addEventListener('blur', function () {
    classes.remove(iframe, 'focus');
  }, false);

  return iframe;
}

function watch (api, callback) {
  api.iframe.contentWindow.document.body.addEventListener('input', debounce(callback, 500), false);
}

},{"debounce-fn":8,"dom-classes":9,"make-editable":11,"pubsub":12}],8:[function(require,module,exports){
module.exports = debounce;

function debounce (fn, wait) {
  var timer;
  var args;

  return function () {
    if (timer != undefined) {
      clearTimeout(timer);
      timer = undefined;
    }

    args = arguments;

    timer = setTimeout(function () {
      fn.apply(undefined, args);
    }, wait);
  };
}

},{}],9:[function(require,module,exports){
/**
 * Module dependencies.
 */

var index = require('indexof');

/**
 * Whitespace regexp.
 */

var whitespaceRe = /\s+/;

/**
 * toString reference.
 */

var toString = Object.prototype.toString;

module.exports = classes;
module.exports.add = add;
module.exports.contains = has;
module.exports.has = has;
module.exports.toggle = toggle;
module.exports.remove = remove;
module.exports.removeMatching = removeMatching;

function classes (el) {
  if (el.classList) {
    return el.classList;
  }

  var str = el.className.replace(/^\s+|\s+$/g, '');
  var arr = str.split(whitespaceRe);
  if ('' === arr[0]) arr.shift();
  return arr;
}

function add (el, name) {
  // classList
  if (el.classList) {
    el.classList.add(name);
    return;
  }

  // fallback
  var arr = classes(el);
  var i = index(arr, name);
  if (!~i) arr.push(name);
  el.className = arr.join(' ');
}

function has (el, name) {
  return el.classList
    ? el.classList.contains(name)
    : !! ~index(classes(el), name);
}

function remove (el, name) {
  if ('[object RegExp]' == toString.call(name)) {
    return removeMatching(el, name);
  }

  // classList
  if (el.classList) {
    el.classList.remove(name);
    return;
  }

  // fallback
  var arr = classes(el);
  var i = index(arr, name);
  if (~i) arr.splice(i, 1);
  el.className = arr.join(' ');
}

function removeMatching (el, re, ref) {
  var arr = Array.prototype.slice.call(classes(el));
  for (var i = 0; i < arr.length; i++) {
    if (re.test(arr[i])) {
      remove(el, arr[i]);
    }
  }
}

function toggle (el, name) {
  // classList
  if (el.classList) {
    return el.classList.toggle(name);
  }

  // fallback
  if (has(el, name)) {
    remove(el, name);
  } else {
    add(el, name);
  }
}

},{"indexof":10}],10:[function(require,module,exports){

var indexOf = [].indexOf;

module.exports = function(arr, obj){
  if (indexOf) return arr.indexOf(obj);
  for (var i = 0; i < arr.length; ++i) {
    if (arr[i] === obj) return i;
  }
  return -1;
};
},{}],11:[function(require,module,exports){
module.exports = enable;

function enable (doc) {
  doc.body.contentEditable = true;

  return {
    exec: call(doc),
    bold: call(doc, 'bold'),
    italic: call(doc, 'italic'),
    underline: call(doc, 'underline'),
    color: call(doc, 'foreColor'),
    bgcolor: call(doc, 'backColor'),
    img: call(doc, 'insertImage'),
    link: call(doc, 'createLink'),
    unlink: call(doc, 'unlink'),
    plain: call(doc, 'removeFormat'),
    undo: call(doc, 'undo'),
    redo: call(doc, 'redo'),
    indent: call(doc, 'indent'),
    outdent: call(doc, 'outdent'),
    selectAll: call(doc, 'selectAll'),
    orderedList: call(doc, 'insertOrderedList'),
    unorderedList: call(doc, 'insertUnorderedList'),
    copy: call(doc, 'copy'),
    paste: call(doc, 'paste'),
    delete: call(doc, 'delete'),
    fontName: call(doc, 'fontName'),
    fontSize: call(doc, 'fontSize'),
    center: call(doc, 'justifyCenter'),
    justify: call(doc, 'justifyFull'),
    left: call(doc, 'justifyLeft'),
    right: call(doc, 'justifyRight'),
    heading: call(doc, 'heading')
  };
}

function exec (doc, cmd, value, showDefaultUI) {
  doc.execCommand(cmd, showDefaultUI || false, value);
};

function call (doc, commandName) {
  return arguments.length == 1 ? custom : command;

  function custom (commandName, value, ui) {
    return exec(doc, commandName, value, ui);
  }

  function command (value, ui) {
    return exec(doc, commandName, value, ui);
  }
}

},{}],12:[function(require,module,exports){
module.exports = pubsub;

function pubsub (mix) {
  var subscribers;
  var subscribersForOnce;

  mix || (mix = function (fn) {
    if (fn) mix.subscribe(fn);
  });

  mix.subscribe = function (fn) {
    if (!subscribers) return subscribers = fn;
    if (typeof subscribers == 'function') subscribers = [subscribers];
    subscribers.push(fn);
  };

  mix.subscribe.once = function (fn) {
    if (!subscribersForOnce) return subscribersForOnce = fn;
    if (typeof subscribersForOnce == 'function') subscribersForOnce = [subscribersForOnce];
    subscribersForOnce.push(fn);
  };

  mix.unsubscribe = function (fn) {
    if (!subscribers) return;

    if (typeof subscribers == 'function') {
      if (subscribers != fn) return;
      subscribers = undefined;
      return;
    }

    var i = subscribers.length;

    while (i--) {
      if (subscribers[i] && subscribers[i] == fn){
        subscribers[i] = undefined;
        return;
      }
    }
  };

  mix.unsubscribe.once = function (fn) {
    if (!subscribersForOnce) return;

    if (typeof subscribersForOnce == 'function') {
      if (subscribersForOnce != fn) return;
      subscribersForOnce = undefined;
      return;
    }

    var i = subscribersForOnce.length;

    while (i--) {
      if (subscribersForOnce[i] && subscribersForOnce[i] == fn){
        subscribersForOnce[i] = undefined;
        return;
      }
    }
  };

  mix.publish = function () {
    var params = arguments;
    var i, len;

    if (subscribers && typeof subscribers != 'function' && subscribers.length) {
      i = -1;
      len = subscribers.length;

      while (++i < len) {
        if (!subscribers[i] || typeof subscribers[i] != 'function') continue;

        try {
          subscribers[i].apply(undefined, params);
        } catch(err) {
          setTimeout(function () { throw err; }, 0);
        }
      };
    } else if (typeof subscribers == 'function') {
      try {
        subscribers.apply(undefined, params);
      } catch(err) {
        setTimeout(function () { throw err; }, 0);
      }
    }

    if (subscribersForOnce && typeof subscribersForOnce != 'function' && subscribersForOnce.length) {
      i = -1;
      len = subscribersForOnce.length;

      while (++i < len) {
        if (!subscribersForOnce[i] || typeof subscribersForOnce[i] != 'function') continue;

        try {
          subscribersForOnce[i].apply(undefined, params);
        } catch(err) {
          setTimeout(function () { throw err; }, 0);
        }
      };

      subscribersForOnce = undefined;
    } else if (typeof subscribersForOnce == 'function') {
      try {
        subscribersForOnce.apply(undefined, params);
      } catch(err) {
        setTimeout(function () { throw err; }, 0);
      }
      subscribersForOnce = undefined;
    }
  };

  return mix;
}

},{}],13:[function(require,module,exports){
(function () {

  'use strict';

  /**
   * Main app file.  Initializes app components.
   */

  var page = require('page'),
      router = require('./router.js'),
      model = require('./model.js'),
      view = require('./view.js'),
      editor = require('./editor.js');

  /**
   * The main app object.
   *
   * @namespace
   */
  var vanillaPress = {

    init: function () {

<<<<<<< HEAD
      model.init();
      router.init();
      view.init();
      editor.init();
    }
=======
},{"./editor.js":10,"./model.js":12,"./router.js":13,"./view.js":14}],9:[function(require,module,exports){
/**
 * Main JSON object of posts, pages and settings
 */
var jsonData =
  {
    posts: [
      {
        id:1,
        date:"2016-01-09T22:05:09",
        modified:"2016-01-09T22:05:09",
        slug:"hello-world",
        type:"posts",
        title:"Hello world!",
        content:"<p>Welcome to WordPress. This is your first post. Edit or delete it, then start writing!</p> ",
      },
      {
        id:2,
        date:"2016-01-10T22:05:09",
        modified:"2016-01-10T22:05:09",
        slug:"learning-javascript",
        type:"posts",
        title:"Learning JavaScript!",
        content:"<p>I'm learning JavaScript and super excited!!!</p> ",
      },
      {
        id:3,
        date:"2016-01-11T22:05:09",
        modified:"2016-01-11T22:05:09",
        slug:"rest-api",
        type:"posts",
        title:"The REST API!",
        content:"<p>I've started working with the REST API in WordPress, what fun!</p> ",
      },
      {
        id:4,
        date:"2016-01-12T22:05:09",
        modified:"2016-01-12T22:05:09",
        slug:"json-data",
        type:"posts",
        title:"JSON Data!",
        content:"<p>So, with the REST API it is posible to pull in WordPress data as pure JSON.  Now I'm figuring out what to do with the data</p> ",
      },
      {
        id:5,
        date:"2016-01-13T22:05:09",
        modified:"2016-01-13T22:05:09",
        slug:"javascript-project",
        type:"posts",
        title:"JavaScript Project",
        content:"<p>I've started working with the REST API in WordPress, what fun!</p> ",
      }
    ],
    pages: [
      {
        id:40,
        date:"2016-01-07T22:05:09",
        modified:"2016-01-07T22:05:09",
        slug:"home",
        type:"pages",
        title:"Home",
        content:"<p>Welcome!</p><p>Reprehenderit sit sunt nisi excepteur deserunt officia ipsum eu reprehenderits deserunt aliqua incididunt cillum dolore.</p><p>Dolor sit amet, consectetur adipisicing elit. Makingsum Lorem look coolsum.</p><p>Sit temporibus sunt doloremque enim alias pariatur debitis dolorum excepturi fugiat assumenda at, totam delectus, possimus reprehenderit earum aliquid nihil, esse voluptatem.</p>",
      },
      {
        id:41,
        date:"2016-01-09T22:05:09",
        modified:"2016-01-09T22:05:09",
        slug:"about",
        type:"pages",
        title:"About Me",
        content:"<p>Hi!  I'm me :)</p><p>Sisi excepteur deserunt officia ipsum eu reprehenderits deserunt aliqua incididunt cillum dolore.</p><p>Dolor sit amet, consectetur adipisicing elit. Makingsum Lorem look coolsum.</p><p>Sit temporibus sunt doloremque enim alias pariatur debitis dolorum excepturi fugiat assumenda at, totam delectus, possimus reprehenderit earum aliquid nihil, esse voluptatem.</p>",
      },
      {
        id:42,
        date:"2016-01-09T22:05:09",
        modified:"2016-01-09T22:05:09",
        slug:"blog",
        type:"pages",
        title:"Blog",
        content:"<p>Welcome to my blog page, please enjoy!</p>",
      },
      {
        id:43,
        date:"2016-01-19T22:06:09",
        modified:"2016-01-19T22:06:09",
        slug:"contact",
        type:"pages",
        title:"Contact",
        content:"<p>Please get in touch!</p><p>Sit temporibus sunt doloremque enim alias pariatur debitis dolorum excepturi fugiat assumenda at, totam delectus, possimus reprehenderit earum aliquid nihil, esse voluptatem.</p>",
      }
    ],
    settings: [
      {
        id:991,
        date:"2016-01-09T22:05:09",
        modified:"2016-01-09T22:05:09",
        slug:"site-name",
        type:"settings",
        title:"Site Name",
        content:"VanillaPress"
      },
      {
        id:992,
        date:"2016-01-09T22:05:09",
        modified:"2016-01-09T22:05:09",
        slug:"site-description",
        type:"settings",
        title:"Site Description",
        content:"A JS Front & Back End"
      }
    ]
>>>>>>> v1
  };

  vanillaPress.init();
})();

},{"./editor.js":15,"./model.js":17,"./router.js":18,"./view.js":19,"page":2}],14:[function(require,module,exports){
/**
 * Main JSON object of posts, pages and settings
 */
var jsonData = [{
  posts: [{
    id: 1,
    date: "2016-01-09T22:05:09",
    modified: "2016-01-09T22:05:09",
    slug: "hello-world",
    type: "posts",
    title: "Hello world!",
    content: "<p>Welcome to WordPress. This is your first post. Edit or delete it, then start writing!</p> "
  }, {
    id: 2,
    date: "2016-01-10T22:05:09",
    modified: "2016-01-10T22:05:09",
    slug: "learning-javascript",
    type: "posts",
    title: "Learning JavaScript!",
    content: "<p>I'm learning JavaScript and super excited!!!</p> "
  }, {
    id: 3,
    date: "2016-01-11T22:05:09",
    modified: "2016-01-11T22:05:09",
    slug: "rest-api",
    type: "posts",
    title: "The REST API!",
    content: "<p>I've started working with the REST API in WordPress, what fun!</p> "
  }, {
    id: 4,
    date: "2016-01-12T22:05:09",
    modified: "2016-01-12T22:05:09",
    slug: "json-data",
    type: "posts",
    title: "JSON Data!",
    content: "<p>So, with the REST API it is posible to pull in WordPress data as pure JSON.  Now I'm figuring out what to do with the data</p> "
  }, {
    id: 5,
    date: "2016-01-13T22:05:09",
    modified: "2016-01-13T22:05:09",
    slug: "javascript-project",
    type: "posts",
    title: "JavaScript Project",
    content: "<p>I've started working with the REST API in WordPress, what fun!</p> "
  }],
  pages: [{
    id: 40,
    date: "2016-01-07T22:05:09",
    modified: "2016-01-07T22:05:09",
    slug: "home",
    type: "pages",
    title: "Home",
    content: "<p>Welcome!</p><p>Reprehenderit sit sunt nisi excepteur deserunt officia ipsum eu reprehenderits deserunt aliqua incididunt cillum dolore.</p><p>Dolor sit amet, consectetur adipisicing elit. Makingsum Lorem look coolsum.</p><p>Sit temporibus sunt doloremque enim alias pariatur debitis dolorum excepturi fugiat assumenda at, totam delectus, possimus reprehenderit earum aliquid nihil, esse voluptatem.</p>"
  }, {
    id: 41,
    date: "2016-01-09T22:05:09",
    modified: "2016-01-09T22:05:09",
    slug: "about",
    type: "pages",
    title: "About Me",
    content: "<p>Hi!  I'm me :)</p><p>Sisi excepteur deserunt officia ipsum eu reprehenderits deserunt aliqua incididunt cillum dolore.</p><p>Dolor sit amet, consectetur adipisicing elit. Makingsum Lorem look coolsum.</p><p>Sit temporibus sunt doloremque enim alias pariatur debitis dolorum excepturi fugiat assumenda at, totam delectus, possimus reprehenderit earum aliquid nihil, esse voluptatem.</p>"
  }, {
    id: 42,
    date: "2016-01-09T22:05:09",
    modified: "2016-01-09T22:05:09",
    slug: "blog",
    type: "pages",
    title: "Blog",
    content: "<p>Welcome to my blog page, please enjoy!</p>"
  }, {
    id: 43,
    date: "2016-01-19T22:06:09",
    modified: "2016-01-19T22:06:09",
    slug: "contact",
    type: "pages",
    title: "Contact",
    content: "<p>Please get in touch!</p><p>Sit temporibus sunt doloremque enim alias pariatur debitis dolorum excepturi fugiat assumenda at, totam delectus, possimus reprehenderit earum aliquid nihil, esse voluptatem.</p>"
  }],
  settings: [{
    id: 991,
    date: "2016-01-09T22:05:09",
    modified: "2016-01-09T22:05:09",
    slug: "site-name",
    type: "settings",
    title: "Site Name",
    content: "VanillaPress"
  }, {
    id: 992,
    date: "2016-01-09T22:05:09",
    modified: "2016-01-09T22:05:09",
    slug: "site-description",
    type: "settings",
    title: "Site Description",
    content: "A JS Front & Back End"
  }]
}];

module.exports = jsonData;

},{}],15:[function(require,module,exports){
(function () {

  'use strict';

  /**
   * Contains the properties and methods for the editor.
   *
   * @exports editor
   */

  var Spinner = require('spin.js'),
      _ = require('underscore'),
      h = require('./lib/helpers.js'),
      router = require('./router.js'),
      model = require('./model.js'),
      view = require('./view.js'),
      wysiwygEditor = require('wysiwyg'),
      wysiwyg;

  /**
   * Main editor panel.
   *
   * @namespace
   */
<<<<<<< HEAD
  var editor = {
    init() {
      editor.listenEditorToggle();
    },
=======
  listenPrimaryLinks: function() {
    var urlSegments = helpers.getAfterHash( this.href );
    editor.currentPostType = urlSegments[0];
    editor.clearMenus();
    editor.showSecondaryMenu();
    event.preventDefault();
  },

>>>>>>> v1

    visible: 'false',
    currentMenu: 'edit',
    currentPost: '',
    currentPostType: '',

    /**
     * Listener for Admin link in editor.
     * Clears menus and shows primary menu.
     *
     */
    listenAdminHomeLink() {
      editor.clearMenus();
      editor.showPrimaryMenu();
      event.preventDefault();
    },

    /**
     * Listeners for links in the primary menu
     * Loads seconday menu
     *
     */
    listenPrimaryLinks() {
      const urlSegments = h.getAfterHash(this.href),

      //const currentPost = urlSegments[0].substring( 0, urlSegments[0].length - 1 );
      currentPost = urlSegments[0];
      editor.currentPostType = currentPost;
      editor.clearMenus();
      editor.showSecondaryMenu();
      event.preventDefault();
    },

<<<<<<< HEAD
    /**
     * Listener for post type link in editor
     * (i.e. Posts, Pages, Settings).
     * Loads secondary menu.
     *
     */
    listenSecondaryNavTitle() {
      editor.clearMenus();
      editor.showSecondaryMenu();
=======
    if ( editor.currentPostType !== 'settings' ) {
      view.currentPost = post;
      view.update();
    } else {
>>>>>>> v1
      event.preventDefault();
    },

    /**
     * Listener to load the post edit field.
     *
    */
    listenLoadEditForm() {
      //event.preventDefault();
      editor.clearMenus();
      const slugs = h.getAfterHash(this.href),
            post = model.getPostBySlugs(slugs);

      console.log('url: ' + this.href);

      console.log('slugs: ' + slugs);
      console.log('post: ' + post);

      editor.currentPost = post;
      editor.currentPostType = post.type;

<<<<<<< HEAD
      if (editor.currentPostType !== 'settings') {
        //view.currentPost = post;
        router.updatePage(this.href);
        console.log(view.currentPost);
      } else {}
=======
    if ( editor.currentPostType !== 'settings' ) {
      // Clear the view
      view.clearContent();
    }
>>>>>>> v1

      editor.showEditPanel();
    },

    /**
     * Listener to the new post field
     *
     */
    listenLoadNewPostForm() {
      let post = { slug: '_new', title: '', content: '' },
          updateBtn = h.getEditorEditUpdateBtn(),
          deleteBtn = h.getDeletePostLink();

      event.preventDefault();
      editor.clearMenus();
      editor.currentPost = post;

      if (editor.currentPostType !== 'settings') {
        // Clear the view
        view.clearContent();
      }

      editor.showEditPanel();
      deleteBtn.classList.add('hidden');
      updateBtn.innerText = 'Save';
    },

    /**
     * Listener for the editor toggle button
     *
     */
    listenEditorToggle() {
      const editorToggleEl = h.getEditorToggleLink();
      editorToggleEl.addEventListener('click', function () {
        editor.toggle();
        event.preventDefault();
      }, false);
    },

    /**
     * Listener to update content from the post add / edit
     * form.
     *
     * @todo Make sure url slug is unique
     */
    listenUpdatePost() {
      let store = model.getLocalStore(),
          newPost = false,
          storePosts;

<<<<<<< HEAD
      event.preventDefault();
=======
      newPost = true;
      editor.currentPost.type = 'posts';
>>>>>>> v1

      // If new post add to local store
      if (editor.currentPost.slug === '_new') {
        let postIds = [],
            highestId;

        newPost = true;
        editor.currentPost.type = 'posts';

        // Slugify title
        editor.currentPost.slug = h.slugifyTitle(editor.currentPost.title);
        // Make sure slug is unique
        editor.currentPost.slug = model.uniqueifySlug(editor.currentPost.slug);

<<<<<<< HEAD
        // Get a new post id
        editor.currentPost.id = model.getNewPostId();
=======
    // Get temp store of posts based on type
    if ( postType === 'posts' ) {
      storePosts = store.posts;
    } else if ( postType === 'pages' ) {
      storePosts = store.pages;
    } else {
      storePosts = store.settings;
    }
>>>>>>> v1

        // Set the date
        editor.currentPost.date = Date();
        editor.currentPost.modified = Date();
      }

<<<<<<< HEAD
      // Get temp store of posts based on type
      storePosts = store[editor.currentPostType]; //

      if (newPost === true) {
        // If new post add post to store
        storePosts.push(editor.currentPost);
      } else {
        // If existing post then update post in store
        storePosts = _.map(storePosts, post => {
          if (post.id === editor.currentPost.id) {
            post.title = editor.currentPost.title;
            post.content = editor.currentPost.content;
            post.modified = Date();
          }
          return post;
        });
      }
=======
    // Add temp store data back
    if ( postType === 'posts' ) {
      store.posts = storePosts;
    } else if ( postType === 'pages' ) {
      store.pages = storePosts;
    } else {
      store.settings = storePosts;
    }
    model.updateLocalStore( store );

    // Update url and current post
    if ( postType === 'posts' ) {
      router.updateHash( 'blog/' + editor.currentPost.slug );
    } else if ( postType === 'pages' ) {
      router.updateHash( editor.currentPost.slug );
    } else {
>>>>>>> v1

      store[editor.currentPostType] = storePosts;

      model.updateLocalStore(store);

      // Update url and current post
      if (editor.currentPostType === 'posts') {
        router.updateHash('blog/' + editor.currentPost.slug);
      } else if (editor.currentPostType === 'pages') {
        router.updateHash(editor.currentPost.slug);
      } else {}

      view.currentPost = editor.currentPost;
      view.update();
      editor.updateSaveBtnText();
    },

    /**
     * Listener to delete post
     *
     */
    listenDeletePost() {
      let store = model.getLocalStore(),
          confirmation = confirm('Are you sure you want to delete this post?'),
          storePosts,
          deleteId,
          deleteIdIndex;

      // Get the index of the item to delete from store
      storePosts = _.reject(store.posts, post => {
        return post.id === editor.currentPost.id;
      });
      // for ( var i = 0, max = storePosts.length; i < max ; i++) {
      //   if ( editor.currentPost.id === storePosts[i].id ) {
      //     deleteIdIndex = i;
      //   }
      // }

      // Only procude with delete if confirmation
      if (confirmation === true) {
        // Remove item from store
        //storePosts.splice( deleteIdIndex, 1 );
        store.posts = storePosts;
        model.updateLocalStore(store);

        // Update current post to empty, show blog posts
        editor.currentPost = {};
        router.updateHash('blog');
        view.currentPost = model.getPostBySlug('blog', 'pages');
        view.update();
        editor.clearMenus();
        editor.showSecondaryMenu();
      }

      event.preventDefault();
    },

<<<<<<< HEAD
    /**
     * Displays the primary menu.
     *
     */
    showPrimaryMenu() {
      let primaryNav = h.getEditorPrimaryNav(),
          primaryLinks = h.getEditorPrimaryNavLinks();
=======
  /**
   * Displays the secondary menu
   *
   */
  showSecondaryMenu: function(){
    var secondaryNav = helpers.getEditorSecondaryNav(),
        postType = editor.currentPostType,
        menuItems = model.getPostsByType( postType ),
        secondaryUl =  helpers.getEditorSecondaryNavUl(),
        secondaryLinks = secondaryUl.getElementsByTagName( 'a' ),
        addNewPostLink = helpers.getEditorAddNewPost(),
        deletePostLink = helpers.getDeletePostLink();

    // Display secondary menu
    secondaryNav.classList.add( 'active' );
    editor.currentMenu = 'secondary';
    editor.updateNavTitle();
    helpers.addMenuItems( menuItems, postType );

    // Add listeners to secondary links
    for ( var i = 0, max = secondaryLinks.length; i < max; i++ ) {
      secondaryLinks[i].addEventListener(
        'click',
        editor.listenLoadEditForm,
        false);
    }

    // Check if need to show new post button
    if ( editor.currentPostType === 'posts' ) {
      addNewPostLink.classList.remove('hidden');
      // Add listener to new post link
      addNewPostLink.addEventListener(
        'click',
        editor.listenLoadNewPostForm,
        false
      );
    } else {
      addNewPostLink.classList.add('hidden');
    }
>>>>>>> v1

      primaryNav.classList.add('active');

<<<<<<< HEAD
      // Add event listeners to primary links
      _.each(primaryLinks, link => {
        link.addEventListener('click', editor.listenPrimaryLinks, false);
      });
      editor.currentMenu = 'primary';
    },

    /**
     * Displays the secondary menu
     *
     */
    showSecondaryMenu() {
      let secondaryNav = h.getEditorSecondaryNav(),
          postType = editor.currentPostType,
          menuItems = model.getPostsByType(postType),
          secondaryUl = h.getEditorSecondaryNavUl(),
          secondaryLinks = secondaryUl.getElementsByTagName('a'),
          addNewPostLink = h.getEditorAddNewPost(),
          deletePostLink = h.getDeletePostLink();

      // Display secondary menu
      secondaryNav.classList.add('active');
      editor.currentMenu = 'secondary';
      editor.updateNavTitle();
      h.addMenuItems(menuItems, postType);

      // Add listeners to secondary links
      _.each(secondaryLinks, link => {
        link.addEventListener('click', editor.listenLoadEditForm, false);
      });
      // for ( var i = 0, max = secondaryLinks.length; i < max; i++ ) {
      //   secondaryLinks[i].addEventListener(
      //     'click',
      //     editor.listenLoadEditForm,
      //     false);
      // }

      // Check if need to show new post button
      if (editor.currentPostType === 'posts') {
        addNewPostLink.classList.remove('hidden');
        // Add listener to new post link
        addNewPostLink.addEventListener('click', editor.listenLoadNewPostForm, false);
      } else {
        addNewPostLink.classList.add('hidden');
      }
    },

    /**
     * Displays the edit post panel
     *
     */
    showEditPanel() {
      let post = editor.currentPost,
          editNav = h.getEditorEditNav(),
          editForm = h.getEditorForm(),
          deleteBtn = h.getDeletePostLink();

      // Display the edit panel and form
      editor.clearEditForm();
      editNav.classList.toggle('active');
      editor.currentMenu = 'edit';
      editor.updateNavTitle();
      editor.fillEditForm();

      // Add event listener to update post
      editForm.addEventListener('submit', editor.listenUpdatePost, false);

      if (editor.currentPostType === 'posts') {
        deleteBtn.classList.remove('hidden');
        // Add event listener to delete post
        deleteBtn.addEventListener('click', editor.listenDeletePost, false);
      } else {
        deleteBtn.classList.add('hidden');
      }
    },

    /**
     * Dynamically fill the edit post form based on the
     * current post.
     *
     */
    fillEditForm() {
      let post = editor.currentPost,
          editTitle = document.getElementById('editTitle'),
          postTitle = h.getPostTitle(),
          titleField = h.getEditorTitleField();

      // Update the title and content fields
      editTitle.value = post.title;
      editContent.value = post.content;

      // Initialize the wysiwyg editor
      wysiwyg = wysiwygEditor(document.getElementById('editContent'));

      //  Add listeners to update the view on field changes
      if (post.type !== 'settings') {
        // Actions if not editing a setting
        titleField.addEventListener('input', function () {
          editor.currentPost.title = this.value;
          view.updateTitle(this.value);
        }, false);
        wysiwyg.onUpdate(function () {
          view.updateContent(wysiwyg.read());
          editor.currentPost.content = wysiwyg.read();
        });
      } else {
        // Live update controls for settings
        if (post.slug === 'site-name') {
          wysiwyg.onUpdate(function () {
            view.updateSiteName(wysiwyg.read());
            editor.currentPost.content = wysiwyg.read();
          });
        } else if (post.slug == 'site-description') {
          wysiwyg.onUpdate(function () {
            view.updateSiteDescription(wysiwyg.read());
            editor.currentPost.content = wysiwyg.read();
          });
        } else {}
      }
    },
=======
  /**
   * Displays the edit post panel
   *
   */
  showEditPanel: function() {
    var post = editor.currentPost,
        editNav = helpers.getEditorEditNav(),
        editForm = helpers.getEditorForm(),
        titleField = helpers.getEditorTitleField();
        deleteBtn = helpers.getDeletePostLink();

    // Display the edit panel and form
    editor.clearEditForm();
    editNav.classList.toggle('active');
    editor.currentMenu = 'edit';
    editor.updateNavTitle();
    editor.fillEditForm();

    // Add event listener to update post
    editForm.addEventListener(
      'submit',
      editor.listenUpdatePost,
      false
    );

    titleField.removeAttribute( 'readonly', 'readonly' );

    if ( editor.currentPostType === 'posts' ) {
      deleteBtn.classList.remove( 'hidden' );
      // Add event listener to delete post
      deleteBtn.addEventListener(
        'click',
        editor.listenDeletePost,
        false
      );
    } else if ( editor.currentPostType === 'settings' ) {
      // Make title input read only
      titleField.setAttribute( 'readonly', 'readonly' );
      deleteBtn.classList.add( 'hidden' );
    } else {
      deleteBtn.classList.add( 'hidden' );
    }
  },

  /**
   * Dynamically fill the edit post form based on the
   * current post.
   *
   */
  fillEditForm: function() {
    var post = editor.currentPost,
        editTitle = document.getElementById('editTitle'),
        postTitle = helpers.getPostTitle(),
        titleField = helpers.getEditorTitleField();

    // Update the title and content fields
    editTitle.value = post.title;
    editContent.value = post.content;

    // Initialize the wysiwyg editor
    wysiwyg = wysiwygEditor(document.getElementById('editContent'));

    //  Add listeners to update the view on field changes
    if ( post.type !== 'settings' ) {
      // Actions if not editing a setting
      titleField.addEventListener( 'input', function() {
        editor.currentPost.title = this.value;
        view.updateTitle( this.value );
      }, false);
      wysiwyg.onUpdate( function() {
        view.updateContent( wysiwyg.read() );
        editor.currentPost.content = wysiwyg.read();
      });
    } else if (  post.slug === 'site-name' ) {
    // Live update controls for settings
      wysiwyg.onUpdate(function () {
        view.updateSiteName( wysiwyg.read() );
        editor.currentPost.content = wysiwyg.read();
      });
    } else if( post.slug == 'site-description' ) {
      wysiwyg.onUpdate( function () {
        view.updateSiteDescription( wysiwyg.read() );
        editor.currentPost.content = wysiwyg.read();
      });
    }
  },

  /**
   * Clears the edit form.
   * Must call before loading data to form.
   *
   */
  clearEditForm: function() {
    var editTitle = document.getElementById( 'editTitle' ),
        wysiwyg = helpers.getEditorWysiwyg();

    // Set the edit fields blank
    editTitle.value = '';
    editContent.value = '';
    // Remove the wysiwyg editor
    if ( wysiwyg !== null ) {
      wysiwyg.remove();
    }
  },

  /**
   * Clears the current menu.
   * Must call before loading a menu.
   *
   */
  clearMenus: function(){
    var navs = helpers.getEditorNavs(),
        navUl = helpers.getEditorSecondaryNavUl(),
        navlinks = navUl.getElementsByTagName( 'a' );

    // Remove active class from all navs
    for ( var j = 0, max = navs.length; j < max; j++ ) {
      var nav = navs[j];
      nav.classList.remove( 'active' );
    }

    // Remove event listeners from all previous nav links
    for ( var i = 0, navMax = navlinks.length; i < navMax; i++ ) {
      navlinks[i].removeEventListener(
        'click',
        editor.refreshMenu,
        false
      );
    }

    // Remove all list items from secondary nav ul tag
    while ( navUl.firstChild ) {
      navUl.removeChild( navUl.firstChild );
    }

  },


  /**
   * Main control for the editor toggle.
   *
   */
  toggle: function() {
    var editorEl = helpers.getEditorEl(),
        toggleEl = helpers.getEditorToggleEl(),
        viewEl = helpers.getViewEl();

    // Clear menus and load edit panel
    editor.clearMenus();
    editor.currentPost = view.currentPost;
    editor.currentPostType = view.currentPost.type;
    editor.currentMenu = 'edit';

    // Toggle editor and nav hidden classes
    editorEl.classList.toggle('hidden');
    toggleEl.classList.toggle('hidden');
    // Toggle whether view nav is disabled
    viewEl.classList.toggle('inactive');

    // Take specific actions if opening or closing editor
    if ( toggleEl.classList.contains( 'hidden' ) === false ) {
      // If opening editor
      var navTitleLink = helpers.getEditorNavTitleLink();
      editor.showEditPanel();
      navTitleLink.addEventListener(
        'click',
        editor.listenSecondaryNavTitle,
        false
      );
      view.listenDisableViewLinks();
    } else {
      // If closing editor
      if ( view.currentPost.type === 'posts' ) {
        router.updateHash( 'blog/' + view.currentPost.slug );
      } else {
        if ( editor.currentPost.slug === '_new' ) {
          // If closing a new post editor
          router.updateHash( 'blog' );
          router.setCurrentPost();
        } else {
          router.updateHash( view.currentPost.slug );
        }
      }
      view.listenEnableViewLinks();
    }
>>>>>>> v1

    /**
     * Clears the edit form.
     * Must call before loading data to form.
     *
     */
    clearEditForm() {
      let editTitle = document.getElementById('editTitle'),
          wysiwyg = h.getEditorWysiwyg();

      // Set the edit fields blank
      editTitle.value = '';
      editContent.value = '';
      // Remove the wysiwyg editor
      if (!_.isNull(wysiwyg)) {
        wysiwyg.remove();
      }
    },

<<<<<<< HEAD
    /**
     * Clears the current menu.
     * Must call before loading a menu.
     *
     */
    clearMenus() {
      let navs = h.getEditorNavs(),
          navUl = h.getEditorSecondaryNavUl(),
          navlinks = navUl.getElementsByTagName('a');

      // Remove active class from all navs
      _.each(navs, nav => {
        nav.classList.remove('active');
      });
=======
  /**
   * Update the editor breadcrumb navigation
   * (i.e. Admin / Posts, Admin / Pages, Admin / Settings, etc. )
   *
   */
  updateNavTitle: function() {
    var postType = editor.currentPostType,
        currentMenu = editor.currentMenu,
        homeLink = helpers.getEditorHomeLinkEl( currentMenu );

    // Add event listener to Admin home link
    homeLink.addEventListener(
      'click',
      editor.listenAdminHomeLink,
      false
    );

    // Add secondary link based on current nav and post type
    if( currentMenu === 'secondary' ) {
      // If on secondary nav
      var navTitleEl = helpers.getEditorNavTitleEl( currentMenu );
      navTitleEl.innerHTML = postType;
    } else {
      // If editing post
      var navTitleLink = helpers.getEditorNavTitleLink();
      navTitleLink.textContent = postType;
      navTitleLink.addEventListener(
        'click',
        editor.listenSecondaryNavTitle,
        false
      );
    }
>>>>>>> v1

      // Remove event listeners from all previous nav links
      if (!_.isEmpty(navUl)) {
        _.each(navLinks, link => {
          link.removeEventListener('click', editor.refreshMenu, false);
        });
      }

      // Remove all list items from secondary nav ul tag
      while (navUl.firstChild) {
        navUl.removeChild(navUl.firstChild);
      }
    },

    /**
     * Main control for the editor toggle.
     *
     */
    toggle() {
      let editorEl = h.getEditorEl(),
          toggleEl = h.getEditorToggleEl(),
          mainNav = h.getMainNavEl();

      // Clear menus and load edit panel
      editor.clearMenus();
      editor.currentPost = view.currentPost;
      editor.currentPostType = view.currentPost.type;
      editor.currentMenu = 'edit';

      // Toggle editor and nav hidden classes
      editorEl.classList.toggle('hidden');
      toggleEl.classList.toggle('hidden');
      // Toggle whether view nav is disabled
      mainNav.classList.toggle('inactive');

      // Take specific actions if opening or closing editor
      if (toggleEl.classList.contains('hidden') === false) {
        // If opening editor
        var navTitleLink = h.getEditorNavTitleLink();
        editor.showEditPanel();
        navTitleLink.addEventListener('click', editor.listenSecondaryNavTitle, false);
        view.listenDisableMainNavLinks();
      } else {
        // If closing editor
        if (view.currentPost.type === 'posts') {
          router.updatePage('blog/' + view.currentPost.slug);
          //router.updateHash( 'blog/' + view.currentPost.slug );
        } else {
            if (editor.currentPost.slug === '_new') {
              // If closing a new post editor
              router.updatePage('blog');
              //router.setCurrentPost();
            } else {
                router.updatePage(view.currentPost.slug);
              }
          }
        view.listenMainNavLinksUpdatePage();
      }
    },

    /**
     * Update the editor breadcrumb navigation
     * (i.e. Admin / Posts, Admin / Pages, Admin / Settings, etc. )
     *
     */
    updateNavTitle() {
      let postType = editor.currentPostType,
          currentMenu = editor.currentMenu,
          homeLink = h.getEditorHomeLinkEl(currentMenu),
          navTitleLink,
          navTitleEl;

      // Add event listener to Admin home link
      homeLink.addEventListener('click', editor.listenAdminHomeLink, false);

      // Add secondary link based on current nav and post type
      if (currentMenu === 'secondary') {
        // If on secondary nav
        navTitleEl = h.getEditorNavTitleEl(currentMenu);
        navTitleEl.innerHTML = postType;
      } else {
        // If editing post
        navTitleLink = h.getEditorNavTitleLink();
        navTitleLink.textContent = postType;
        navTitleLink.addEventListener('click', editor.listenSecondaryNavTitle, false);
      }
    },

    /**
     * Saves post in edit form.
     * Mimics live updating text: "Saving, Saved!"
     *
     */
    updateSaveBtnText() {

      let btn = h.getEditorEditUpdateBtn(),
          finalText = 'Udpate',
          savedText = 'Saved!',
          spinnerOpts = {
        color: '#fff',
        lines: 8,
        length: 4,
        radius: 3,
        width: 1,
        left: '10%'
      },
          spinner = new Spinner(spinnerOpts).spin(btn),

      // Displays save text
      saving = function () {
        setTimeout(() => {
          spinner.stop();
          btn.innerText = savedText;
          saved();
        }, 900);
      },

      // Displays final text
      saved = function () {
        setTimeout(() => {
          btn.innerText = finalText;
        }, 1000);
      };

      // Update btn text and start saving
      btn.innerText = 'Saving...';
      saving();
    }
  };

<<<<<<< HEAD
  module.exports = editor;
})();
=======
    return urlSegments;
  },

  addMenuItems: function( menuItems, postType ) {
    menuItems.forEach( function( item ){

      var a = helpers.createLink( item.title, postType, item.slug );
      helpers.addMenuItem( a );

    });
  },

  addMenuItem: function( menuItem ) {
    var ul = document.querySelector( '#editor nav#secondary ul' ),
        li = document.createElement( 'li' );
>>>>>>> v1

},{"./lib/helpers.js":16,"./model.js":17,"./router.js":18,"./view.js":19,"spin.js":5,"underscore":6,"wysiwyg":7}],16:[function(require,module,exports){
(function () {

  'use strict';

  Array.prototype.isArray = true;
  const _ = require('underscore'),
        h = {

<<<<<<< HEAD
    getAfterHash(url) {
      let urlSegments = [],
          pageUrl;
=======
    if ( 'posts' === postType  ) {
      a.href = '#blog/' + slug;
    } else if ( 'settings' === postType ) {
      a.href = '#settings/' + slug;
    } else {
      a.href = '#' + slug;
    }
>>>>>>> v1

      url = url || '';

      if (url !== '') {
        url = url.substring(url.indexOf('#') + 1);
        urlSegments = url.split('/');
      } else {
        pageUrl = window.location.hash.substr(1);
        urlSegments = pageUrl.split('/');
      }

      return urlSegments;
    },

<<<<<<< HEAD
    addMenuItems(menuItems, postType) {
      _.map(menuItems, item => {
        let link = h.createLink(item.title, postType, item.slug);
        h.addMenuItem(link);
      });
    },
=======
    contentDiv = document.createElement( 'div' );
    console.log( post );
    excerpt = post.content;
>>>>>>> v1

    addMenuItem(menuItem) {
      let ul = document.querySelector('#editor nav#secondary ul'),
          li = document.createElement('li');

      li.appendChild(menuItem);
      ul.appendChild(li);
    },

    createLink(text, postType, slug) {
      const linkText = document.createTextNode(text);
      let link = document.createElement('a');

      link.appendChild(linkText);

      if (postType === 'posts') {
        link.href = '/blog/' + slug + '/';
      } else if (postType === 'settings') {
        link.href = '/settings/' + slug + '/';
      } else {
        link.href = '/' + slug + '/';
      }

      return link;
    },

    createPostMarkup(post) {
      const title = document.createTextNode(post.title);
      let articleEl = document.createElement('article'),
          titleEl = document.createElement('h3'),
          titleLink = document.createElement('a'),
          contentDiv,
          excerpt;

      titleLink.appendChild(title);
      titleLink.href = '/blog/' + post.slug + '/';
      titleEl.appendChild(titleLink);

      contentDiv = document.createElement('div');
      excerpt = post.content;

      if (excerpt.length > 100) {
        excerpt = excerpt.substr(0, 60) + '\u2026';
      }

      contentDiv.innerHTML = excerpt;

      articleEl.appendChild(titleEl);
      articleEl.appendChild(contentDiv);

      return articleEl;
    },

    getEditorEl() {
      return document.getElementById('editor');
    },

    getEditorToggleEl() {
      return document.getElementById('editorToggle');
    },

<<<<<<< HEAD
    getEditorToggleLink() {
      return document.querySelector('#editorToggle a');
    },
=======
    if ( currentMenu === 'edit' ) {
      nav = helpers.getEditorEditNav();
    } else if ( currentMenu === 'secondary' ) {
      nav = helpers.getEditorSecondaryNav();
    } else {
      nav = helpers.getEditorPrimaryNav();
    }

    return nav;
  },

  getEditorEditNav: function() {
    return  document.querySelector( '#editor nav#edit' );
  },

  getEditorHomeLinkEl: function( currentMenu ) {
    var nav = helpers.getCurrentNavEl( currentMenu );
    return nav.querySelector( 'h3 .go-home' );
  },

  getEditorNavTitleEl: function( currentMenu ) {
    var nav = helpers.getCurrentNavEl( currentMenu );
    return nav.querySelector( 'h3 span' );
  },

  getEditorNavTitleLink: function() {
    var editNav = helpers.getEditorEditNav();
    return editNav.querySelector( 'h3 span a' );
  },

  getEditorTitleField: function() {
    return document.getElementById( 'editTitle' );
  },

  slugifyTitle: function( title ) {
    var slug = title.trim();

    slug = slug.replace(/[^a-zA-Z0-9\s]/g,"");
    slug = slug.toLowerCase();
    slug = slug.replace(/\s/g,'-');

    return slug;
  },

  getEditorWysiwyg: function() {
    var editNav = helpers.getEditorEditNav();
    return editNav.querySelector( 'form iframe' );
  },

  getEditorForm: function() {
    var editNav = helpers.getEditorEditNav();
    return editNav.querySelector( 'form' );
  },

  getEditorEditUpdateBtn: function() {
    return document.getElementById( 'editUpdateBtn' );

  },

  getViewEl: function() {
    return document.getElementById( 'view' );
  },

  getViewLinks: function() {
    return document.querySelectorAll( '#view a' );
  },

  getSiteName: function() {
    var siteNameEl = document.getElementById( 'siteName' );
    return siteNameEl.querySelector( 'a' );
  },

  getSiteDescription: function() {
    return document.getElementById( 'siteDesription' );
  },

  getMainNavEl: function() {
    var mainNavEl = document.getElementById( 'mainNav' );
    return mainNavEl;
  },

  getMainNavLinks: function() {
    var mainNav = document.getElementById( 'mainNav' ),
        links = mainNav.getElementsByTagName( 'a' );
    return links;
  },

  getPostTitle: function() {
    var titleEl = document.getElementById( 'pageTitle' );
    return titleEl;
  },

  getPrimaryContentEl: function(){
    var primaryContentEL = document.querySelector( '#view .content .primary' );
    return primaryContentEL;
  }
>>>>>>> v1

    getEditorNavs() {
      var editorEl = h.getEditorEl();
      return editorEl.getElementsByTagName('nav');
    },

    getEditorPrimaryNav() {
      return document.querySelector('#editor nav#primary');
    },

    getEditorPrimaryNavLinks() {
      let primaryNav = h.getEditorPrimaryNav();
      return primaryNav.getElementsByTagName('a');
    },

<<<<<<< HEAD
    getEditorSecondaryNav() {
      return document.querySelector('#editor nav#secondary');
    },
=======
var jsonData = require( './data.js' ),
    error404 = {type:'404',title:'404 Error', content: 'Please try another page'};
>>>>>>> v1

    getEditorSecondaryNavUl() {
      let secondaryNav = h.getEditorSecondaryNav();
      return secondaryNav.querySelector('ul');
    },

<<<<<<< HEAD
    getEditorAddNewPost() {
      return document.querySelector('#editor #addNew a');
    },

    getDeletePostLink() {
      return document.querySelector('#deletePost a');
    },

    getCurrentNavEl(currentMenu) {
      let nav;

      if (currentMenu === 'edit') {
        nav = h.getEditorEditNav();
      } else if (currentMenu === 'secondary') {
        nav = h.getEditorSecondaryNav();
      } else {
        nav = h.getEditorPrimaryNav();
      }

      return nav;
    },

    getEditorEditNav() {
      return document.querySelector('#editor nav#edit');
    },

    getEditorHomeLinkEl(currentMenu) {
      let currentNav = h.getCurrentNavEl(currentMenu);
      return currentNav.querySelector('h3 .go-home');
    },

    getEditorNavTitleEl(currentMenu) {
      let currentNav = h.getCurrentNavEl(currentMenu);
      return currentNav.querySelector('h3 span');
    },

    getEditorNavTitleLink() {
      let editNav = h.getEditorEditNav();
      return editNav.querySelector('h3 span a');
    },

    getEditorTitleField() {
      return document.getElementById('editTitle');
    },

    slugifyTitle(title) {
      return title.trim().replace(/[^a-zA-Z0-9\s]/g, "").toLowerCase().replace(/\s/g, '-');
    },

    getEditorWysiwyg() {
      let editNav = h.getEditorEditNav();
      return editNav.querySelector('form iframe');
    },

    getEditorForm() {
      let editNav = h.getEditorEditNav();
      return editNav.querySelector('form');
    },

    getEditorEditUpdateBtn() {
      return document.getElementById('editUpdateBtn');
    },

    getSiteName() {
      let siteName = document.getElementById('siteName');
      return siteName.querySelector('a');
    },

    getSiteDescription() {
      return document.getElementById('siteDesription');
    },

    getMainNavEl() {
      return document.getElementById('mainNav');
    },

    getMainNavLinks() {
      let mainNav = document.getElementById('mainNav');
      return mainNav.getElementsByTagName('a');
    },

    getPostTitle() {
      return document.getElementById('pageTitle');
    },

    getPrimaryContentEl() {
      return document.querySelector('#view .content .primary');
    }

  };

  module.exports = h;
})();

},{"underscore":6}],17:[function(require,module,exports){
(function () {

  'use strict';
=======
/**
 * Main model object.
 *
 * @namespace
 */
var model = {
  /**
   * Initializes model and sets local store if empty
   *
   */
  init: function() {
    var localStore = model.getLocalStore();
    if( typeof localStore === 'undefined' || localStore === null ||
        localStore === '' ) {
      localStorage.setItem(
        'vanillaPress',
        JSON.stringify( jsonData )
      );
    }
  },

  /**
   * Gets posts based on post type.
   *
   * @param postType {string} The type of content needed (post, page, etc)
   * @return posts {array} Posts matching post type (Posts, Pages, etc)
   */
  getPostsByType: function( postType ) {
    // Get content from local store
    var data = model.getLocalStore(),
        posts;

    // Get posts from local store
    if ( 'posts' === postType ) {
      return data.posts;
    } else if ( 'pages' === postType ) {
      return data.pages;
    } else if ( 'settings' === postType ) {
      return data.settings;
    } else {
      return  [ error404 ];
    }
  },

  /**
   * Get a single post based on url slugs
   *
   * @param slugs {array} The url slugs for the post
   * @return post {object} Single post based on url slugs
   *
   */
  getPostBySlugs: function( slugs ) {
    var post;

    if ( slugs.length > 1 && 'blog' === slugs[0] ) {
      // If blog post
      return model.getPostBySlug( slugs[1], 'posts' );
    } else if ( slugs.length > 1 && 'settings' === slugs[0] ) {
      // If setting
      return model.getPostBySlug( slugs[1], 'settings' );
    } else {
      // If page
      if( '' === slugs[0] ) slugs[0] = 'home';
      return model.getPostBySlug( slugs[0], 'pages');
    }
  },

  /**
   * Get single post slug and post type
   *
   * @param slug {string} The url slug for the post
   * @param postType {string} The post type for the post
   * @return post {object} Single post based on url slugs
   *
   */
  getPostBySlug: function( slug, postType ){
    // Get contet from local storage
    var data = model.getLocalStore(),
        posts = model.getPostsByType ( postType ),
        post;

    // Get the post from store based on the slug
    post = posts.filter( function( post ) {
      return post.slug == slug;
    });

    return post[0];
  },
>>>>>>> v1

  /**
   * This file contains methods having to do with
   * getting and setting of data.  Leverages local
   * store.
   *
<<<<<<< HEAD
   * @exports model
=======
   * @return next highest id based on existing posts
   */
  getNewPostId: function() {
    var localStore = model.getLocalStore(),
        postIds = [],
        newId,
        highestId;

    localStore.posts.forEach(function( post ) {
      postIds.push( Number( post.id ) );
    });
    highestId = Math.max.apply( Math, postIds );
    newId = highestId + 1;
    return newId;
  },

  /**
   * Checks if slug exists.
   * Adds a number to the end of the slug
   * until finds a unique slug.
>>>>>>> v1
   *
   */
<<<<<<< HEAD

  const _ = require('underscore'),
        h = require('./lib/helpers.js'),
        jsonData = require('./data.js');
=======
  uniqueifySlug: function( slug ) {
    var slugExists,
        n = 1,
        uniqueSlug = slug;

    // Check if slug exists
    slugExists = model.checkIfSlugExists( slug );
    while ( slugExists ) {
      uniqueSlug = slug + '-' + n;
      slugExists = model.checkIfSlugExists( uniqueSlug );
      n++;
    }

    return uniqueSlug;
  },
>>>>>>> v1

  /**
   * Main model object.
   *
   * @namespace
   */
  var model = {
    // Init function to load data into local store
    init() {
      let localStore = model.getLocalStore();
      if (_.isNull(localStore)) {
        localStorage.setItem('vanillaPress', JSON.stringify(jsonData));
        localStore = model.getLocalStore();
      }
    },

    /**
     * Gets posts based on post type.
     *
     * @param postType {string} The type of content needed (post, page, etc)
     * @return posts {array} Posts matching post type (Posts, Pages, etc)
     */
    getPostsByType(postType) {
      // Get content from local store
      const data = model.getLocalStore();
      // Return just data.postType ie data.posts
      return data[postType];
    },

    /**
     * Get a single post based on url slugs
     *
     * @param slugs {array} The url slugs for the post
     * @return post {object} Single post based on url slugs
     *
     */
    getPostBySlugs(slugs) {
      let post;
      if (slugs.length > 1 && slugs[0] === 'blog') {
        // If blog post
        post = model.getPostBySlug(slugs[1], 'posts');
      } else if (slugs.length > 1 && slugs[0] === 'settings') {
        // If setting
        post = model.getPostBySlug(slugs[1], 'settings');
      } else {
        // If page
        if (slugs[0] === '') slugs[0] = 'home';
        post = model.getPostBySlug(slugs[0], 'pages');
      }

      return post;
    },

<<<<<<< HEAD
    /**
     * Get single post slug and post type
     *
     * @param slug {string} The url slug for the post
     * @param postType {string} The post type for the post
     * @return post {object} Single post based on url slugs
     *
     */
    getPostBySlug(slug, postType) {
      const store = model.getLocalStore();
      let posts, post;

      // Get posts from local storage
      posts = store[postType];
      // Filter the posts to match the slug
      post = _.filter(posts, post => {
        return post.slug == slug;
      });
=======
  /**
   * Gets content from local store
   *
   * @return store {object} Local storage object with all content
   */
  getLocalStore: function() {
    return JSON.parse( localStorage.getItem( 'vanillaPress' ) );
  },

  /**
   * Saves temporary store to local storage.
   *
   * @param store {object} Temporary store to update
   */
  updateLocalStore: function( store ) {
    // Makes sure to stringify store object before saving
    localStorage.setItem( 'vanillaPress', JSON.stringify( store ) );
  },
>>>>>>> v1

      return post[0];
    },

    /**
     * Gets content from local store
     *
     * @return store {object} Local storage object with all content
     */
    getLocalStore() {
      const store = JSON.parse(localStorage.getItem('vanillaPress'));
      let newStore = {};

<<<<<<< HEAD
      if (_.isNull(store)) {
        newStore = store;
      } else {
        newStore = store[0];
      }
      return newStore;
    },

    /**
     * Gets a unique id for a new post
     *
     * @return next highest id based on existing posts
     */
    getNewPostId() {
      const store = model.getLocalStore();

      // Get the current highest post id
      let latestPost = _.max(store.posts, post => {
        return post.id;
      });
      // Return new unique id
      return latestPost.id + 1;
    },

    /**
     * Checks if slug exists.
     * Adds a number to the end of the slug
     * until finds a unique slug.
     *
     * @param slug {string}
     * @return next highest id based on existing posts
     */
    uniqueifySlug: function (slug) {
      let slugExists,
          n = 1;

      // Check if slug exists
      slugExists = model.checkIfSlugExists(slug);
=======
},{"./data.js":9}],13:[function(require,module,exports){
/**
 * The router object takes actions based on the
 * hash in the url (i.e. #content-here)
 *
 * @exports router
 */

var helpers = require( './lib/helpers.js' ),
    model = require( './model.js' ),
    view = require( './view.js' ),
    error404 = {type:'404',title:'404 Error', content: 'Please try another page'};

/**
 * The main router object.
 *
 * @namespace
 */
var router = {
  init: function() {
    router.refreshCurrentPost();
    router.listenPageChange();
  },

  /**
   * Add listener to url changes
   *
   */
  listenPageChange: function() {
    window.addEventListener(
      'hashchange',
      router.refreshCurrentPost,
      false
    );
  },

  /**
   * Updates the the current post based on url
   *
   */
  refreshCurrentPost: function() {
    var slugs = helpers.getAfterHash(),
        post = model.getPostBySlugs( slugs );

    if( post ) {
      view.setCurrentPost( post );
    } else {
      // If page does not exist set 404 page
      view.setCurrentPost( error404 );
    }


  },

  /**
   * Helper function to update hash based on slug
   *
   */
  updateHash: function(slug) {
    window.location.hash = slug;
  }
>>>>>>> v1

      // If slug exists, get unique string
      if (slugExists === true) {
        // Append -n to end of url
        slug = slug + '-' + n;
        // Keep adding -n++ until get unique slug
        while (slugExists === true) {
          slug = slug.substring(0, slug.lastIndexOf('-'));
          slug = slug + '-' + n;
          slugExists = model.checkIfSlugExists(slug);
          n++;
        }
      }

      return slug;
    },

    /**
     * Checks if slug exists.
     *
     * @param slug {string}
     * @return true if slug exists or false if does not exist
     */
    checkIfSlugExists: function (slug) {
      const store = model.getLocalStore();

      // Check if filtering posts for slug is empty
      return _.isEmpty(_.filter(store.posts, post => {
        return post.slug === slug;
      })) ? false : true;
    },

    /**
     * Saves temporary store to local storage.
     *
     * @param store {object} Temporary store to update
     */
    updateLocalStore: function (store) {
      let newStore = [store];
      // Makes sure to stringify store object before saving
      localStorage.setItem('vanillaPress', JSON.stringify(newStore));
    },

<<<<<<< HEAD
    /**
     * Deletes data from local storage.
     *
     */
    removeLocalStore: function () {
      localStorage.removeItem('vanillaPress');
    }
  };

  module.exports = model;
})();

},{"./data.js":14,"./lib/helpers.js":16,"underscore":6}],18:[function(require,module,exports){
(function () {

  'use strict';

  /**
   * The router object takes actions based on the
   * hash in the url (i.e. #content-here)
=======
/**
 * Main view object
 *
 * @namespace
 */
var view = {
  init: function() {
    view.loadMainHeader();
  },

  currentPost: '',

  /**
   * Listener to disable view navigation while
   * editor is open.
   *
   */
  listenDisableViewLinks: function() {
    var links = helpers.getViewLinks();
    for ( var i = 0, len = links.length; i < len; i++ ) {
      // Add listener to deactivate main nav
      links[i].addEventListener('click', view.disableNav, false);
    }
  },

  /**
   * Listener to disable links in the view while the
   * editor is open.
>>>>>>> v1
   *
   * @exports router
   */
<<<<<<< HEAD

  const _ = require('underscore'),
        page = require('page'),
        h = require('./lib/helpers.js'),
        model = require('./model.js'),
        view = require('./view.js');
=======
  listenEnableViewLinks: function() {
    var links = helpers.getViewLinks();
    for ( var i = 0, len = links.length; i < len; i++ ) {
      // Add listener to deactivate main nav
      links[i].removeEventListener('click', view.disableNav, false);
    }
  },


  /**
   * Sets the current post and updates the view
   *
   * @param post {object} The new current post
   */
   setCurrentPost: function( post ) {
     view.currentPost = post;
     view.update();
   },
>>>>>>> v1

  /**
   * The main router object.
   *
   * @namespace
   */
  var router = {
    init() {
      page('/', router.loadPage);
      page('/about', router.loadPage);
      page('/contact', router.loadPage);
      page('/blog', router.loadPage);
      page('/blog/:slug', router.loadBlog);
      page.start();
      router.setCurrentPost();
      view.update();
      //router.listenPageChange();
    },
    updatePage(url) {
      if (url === 'home') url = '/';
      page(url);
    },
    // Loads page based on url
    loadPage(ctx) {
      let slugs = [],
          post;
      if (ctx.path === '') {
        slugs.push('home');
      } else {
        // remove the / from the slug
        slugs.push(ctx.path.substring(0, ctx.path.length - 1).replace('/', ''));
      }
      post = model.getPostBySlugs(slugs);
      view.currentPost = post;
      view.update();
    },
    loadBlog(ctx) {
      let slugs = [],
          post;
      // remove the / from the slug
      slugs.push(ctx.path.substring(0, ctx.path.length - 1).replace('/', '').split('/'));
      post = model.getPostBySlugs(slugs[0]);
      // console.log( slugs );
      view.currentPost = post;
      view.update();
    },
    // Add listener to url changes
    listenPageChange() {
      window.addEventListener('hashchange', router.setCurrentPost, false);
    },

    // Updates the the current post based on url
    setCurrentPost() {
      const slugs = h.getAfterHash(),
            post = model.getPostBySlugs(slugs);

      if (_.isUndefined(post)) {
        // If page does not exist set 404 page
        view.currentPost = {
          title: '404',
          content: '<p>Oops! Please try a different url</p>',
          slug: '404'
        };
      } else {
        view.currentPost = post;
      }

      view.update();
    },

<<<<<<< HEAD
    // Helper function to update hash based on slug
    updateHash(slug) {
      window.location.hash = slug;
=======
    view.removeBlogPosts();
    if ( 'blog' === view.currentPost.slug ) {
      // Append blog posts to blog page
      view.loadBlogPosts();
>>>>>>> v1
    }

  };

  module.exports = router;
})();

},{"./lib/helpers.js":16,"./model.js":17,"./view.js":19,"page":2,"underscore":6}],19:[function(require,module,exports){
(function () {

  'use strict';

  /**
   * This file controls the main front end view
   * of the app.
   *
   *
   * @exports view
   */

  const _ = require('underscore'),
        h = require('./lib/helpers.js'),
        model = require('./model.js');

  /**
   * Main view object
   *
   * @namespace
   */
<<<<<<< HEAD
  var view = {
    init() {
      view.listenMainNavLinksUpdatePage();
      view.loadMainHeader();
    },
=======
  loadBlogPosts: function() {
    var posts = model.getPostsByType( 'posts' ),
        postsMarkup = document.createElement( 'section' ),
        primaryContentEL;
>>>>>>> v1

    currentPost: '',

    /**
     * Listener activate and deactivate main nav.
     * @function
    */
    listenMainNavLinksUpdatePage() {
      const links = document.querySelectorAll('#mainNav a');
      _.each(links, link => {
        // Add listener to activate main nav
        //      link.addEventListener( 'click', view.mainNavControl, false );
        // Remove listener that disables main nav
        link.removeEventListener('click', view.disableNav);
      });
    },

    /**
     * Listener to disable the main nav while the
     * editor is open.
     *
     */
    listenDisableMainNavLinks() {
      const links = h.getMainNavLinks();
      _.each(links, link => {
        // Add listener to deactivate main nav
        link.removeEventListener('click', view.mainNavControl);
        // Remove listener to disable main nav
        link.addEventListener('click', view.disableNav, false);
      });
    },

    /**
     * Main nav listener to load proper page
     *
     */
    mainNavControl() {
      const newPageSlugs = h.getAfterHash(this.href),
            post = model.getPostBySlugs(newPageSlugs);
      view.currentPost = post;
      view.update();
    },

    /**
     * Updates the view based on current post
     *
     */
    update() {
      view.updateTitle(view.currentPost.title);
      view.updateContent(view.currentPost.content);

      view.removeBlogPosts();
      if (view.currentPost.slug === 'blog') {
        // Append blog posts to blog page
        view.loadBlogPosts();
      }
    },

    /**
     * Loads the main header based on settings data in local store.
     *
     */
    loadMainHeader() {
      // Get site name and description from store
      const siteName = model.getPostBySlug('site-name', 'settings'),
            siteDescription = model.getPostBySlug('site-description', 'settings');
      view.updateSiteName(siteName.content);
      view.updateSiteDescription(siteDescription.content);
    },

    /**
     * Helper function to update to post content in the view.
     *
     * @param content {string} The site name to display
     */
    updateSiteName(content) {
      let siteName = h.getSiteName();
      siteName.innerHTML = content;
    },

    /**
     * Helper function to update to the site description in the view.
     *
     * @param content {string} The site description to display
     */
    updateSiteDescription(content) {
      let siteDescription = h.getSiteDescription();
      siteDescription.innerHTML = content;
    },

    /**
     * Helper function to update main page title in the view.
     *
     * @param title {string} The title to display
     */
    updateTitle(title) {
      let titleEl = document.getElementById('pageTitle');
      titleEl.innerHTML = title;
    },

    /**
     * Helper function to update main page content in the view.
     *
     * @param content {string} The content to display
     */
    updateContent(content) {
      let contentEl = document.getElementById('pageContent');
      contentEl.innerHTML = content;
    },

    /**
     * Helper function to clear title and content
     * in the main view
     *
     */
    clearContent() {
      let titleEl = document.getElementById('pageTitle'),
          contentEl = document.getElementById('pageContent');

      titleEl.innerHTML = '';
      contentEl.innerHTML = '';
    },

    /**
     * Gets blog posts and appends them to the page.
     *
     */
    loadBlogPosts() {
      var posts = model.getPostsByType('posts'),
          postsSection = document.createElement('section'),
          primaryContentEL = h.getPrimaryContentEl();

      postsSection.id = 'blogPosts';
      // Get markup for each post
      //console.log( posts );
      _.each(posts, post => {
        postsSection.appendChild(h.createPostMarkup(post));
      });
      // Append posts to page
      primaryContentEL.appendChild(postsSection);
    },

    /**
     * Remove blog posts from page
     *
     */
    removeBlogPosts() {
      let blogPost = document.getElementById('blogPosts');
      if (blogPost) {
        blogPost.remove();
      }
    },

    /**
     * Prevents main nav from working. Used when editor is open.
     *
     */
    disableNav() {
      event.preventDefault();
    }
  };
  module.exports = view;
})();

},{"./lib/helpers.js":16,"./model.js":17,"underscore":6}]},{},[13]);
