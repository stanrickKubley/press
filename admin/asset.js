// Finds an image for the editor, wherever it currently lives:
// 1. a photo picked in this browser session (kept in memory),
// 2. the live site (published entries),
// 3. the entry's draft on GitHub (saved but not yet published; not on the live site until Publish).
// Widgets call PressAsset.url(path) to draw, PressAsset.ensure(path) to look it up, and
// PressAsset.onChange(fn) to redraw when a draft image arrives.
(function () {
  var found = {};      // path -> url to draw (blob: or live URL)
  var pending = {};    // path -> Promise
  var listeners = [];
  var dirCache = {};   // ref|dir -> Promise<listing>
  var MIME = { png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", webp: "image/webp", gif: "image/gif", svg: "image/svg+xml" };

  function local(path) { return window.PRESS_LOCAL && window.PRESS_LOCAL[path]; }
  function live(path) { try { return new URL(path, document.baseURI).href; } catch (e) { return path; } }
  function notify() { listeners.slice().forEach(function (fn) { try { fn(); } catch (e) {} }); }

  function token() {
    var id = window.netlifyIdentity, u = id && id.currentUser && id.currentUser();
    return u ? u.jwt() : Promise.reject(new Error("not signed in"));
  }
  function api(p, tok, accept) {
    var headers = { Authorization: "Bearer " + tok };
    if (accept) headers.Accept = accept;
    return fetch("/.netlify/git/github/" + p, { headers: headers }).then(function (r) {
      if (!r.ok) throw new Error(r.status);
      return accept ? r.blob() : r.json();
    });
  }
  function currentSlug() {
    var m = location.hash.match(/\/collections\/([^/]+)\/entries\/([^/?#]+)/);
    return m ? { collection: m[1], slug: decodeURIComponent(m[2]) } : null;
  }
  function repoPath(path) {
    var cfg = window.PRESS_PATHS || { media: "images/uploads", public: "/images/uploads" };
    if (path.indexOf(cfg.public) === 0) return cfg.media + path.slice(cfg.public.length);
    return path.replace(/^\//, "");
  }
  function fromRepo(path, tok, ref) {
    var rp = repoPath(path), dir = rp.replace(/\/[^/]*$/, ""), name = rp.slice(dir.length + 1);
    var key = ref + "|" + dir;
    if (!dirCache[key]) dirCache[key] = api("contents/" + dir + "?ref=" + encodeURIComponent(ref), tok)
      .catch(function (e) { delete dirCache[key]; throw e; });
    return dirCache[key].then(function (list) {
      var f = (list || []).find(function (x) { return x.name === name; });
      if (!f) throw new Error("missing");
      return api("git/blobs/" + f.sha, tok, "application/vnd.github.raw");
    }).then(function (b) {
      var ext = (name.match(/\.([a-z0-9]+)$/i) || [])[1];
      return URL.createObjectURL(new Blob([b], { type: MIME[(ext || "").toLowerCase()] || b.type }));
    });
  }
  function liveExists(path) {
    return fetch(live(path), { method: "HEAD", cache: "no-store" }).then(function (r) {
      return r.ok && !/text\/html/.test(r.headers.get("content-type") || "");
    }).catch(function () { return false; });
  }

  function ensure(path) {
    if (!path) return Promise.resolve("");
    if (local(path)) return Promise.resolve(local(path));
    if (found[path]) return Promise.resolve(found[path]);
    if (pending[path]) return pending[path];
    pending[path] = liveExists(path).then(function (ok) {
      if (ok) return live(path);
      var e = currentSlug();
      return token().then(function (tok) {
        var tryRef = function (refs) {
          if (!refs.length) throw new Error("not found");
          return fromRepo(path, tok, refs[0]).catch(function () { return tryRef(refs.slice(1)); });
        };
        // Draft branch first (unpublished entry), then main (published but the site is still rebuilding).
        return tryRef((e ? ["cms/" + e.collection + "/" + e.slug] : []).concat(["main"]));
      });
    }).then(function (u) {
      delete pending[path];
      var changed = u !== live(path);
      found[path] = u;
      if (changed) notify();
      return u;
    }, function () {
      delete pending[path];
      return live(path);
    });
    return pending[path];
  }

  window.PressAsset = {
    url: function (path) {
      if (!path) return "";
      return local(path) || found[path] || live(path);
    },
    ensure: ensure,
    remember: function (path, url) { found[path] = url; notify(); },
    onChange: function (fn) {
      listeners.push(fn);
      return function () { var i = listeners.indexOf(fn); if (i >= 0) listeners.splice(i, 1); };
    }
  };
  // A new save/publish can move images between draft and live; forget lookups when switching entries.
  window.addEventListener("hashchange", function () { dirCache = {}; });
})();
