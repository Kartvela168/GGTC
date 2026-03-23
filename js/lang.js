// მრავალენოვანი მხარდაჭერა: დეტექცია, გადამისამართება, ლინკების გადაწერა და ენის გადამრთველი
(function() {
    var STORAGE_KEY = 'gas-flows-lang';

    // ენის დეტექცია მისამართის (URL) მიხედვით
    function detectLangFromPath(pathname) {
        // file:// პროტოკოლის დროს (ლოკალურად გაშვებისას)
        if (window.location.protocol === 'file:') {
            var segments = pathname.split('/').filter(Boolean);
            for (var i = 0; i < segments.length; i++) {
                if (segments[i] === 'ka') return 'ka';
                if (segments[i] === 'de') return 'de';
                if (segments[i] === 'ru') return 'ru';
            }
            return 'en';
        }
        // ვებ-სერვერზე გაშვებისას
        if (pathname.indexOf('/ka/') === 0) return 'ka';
        if (pathname.indexOf('/de/') === 0) return 'de';
        if (pathname.indexOf('/ru/') === 0) return 'ru';
        return 'en';
    }

    function getStoredLang() {
        try { return localStorage.getItem(STORAGE_KEY) || null; } catch (_) { return null; }
    }
    function setStoredLang(lang) {
        try { localStorage.setItem(STORAGE_KEY, lang); } catch (_) {}
    }

    // მოკლე მისამართების შესაბამისობა ფაილების სახელებთან
    function mapToFilename(segment) {
        if (!segment || segment === '/') return 'index.html';
        var name = segment.replace(/^\//, '');
        if (/\.[a-zA-Z0-9]+$/.test(name)) return name; // თუ უკვე ფაილის სახელია
        var lower = name.toLowerCase();
        if (lower === 'index') return 'index.html';
        if (lower === 'aga8') return 'aga8.html';
        if (lower === 'aga8flow') return 'AGA8Flow.html';
        if (lower === 'pressures') return 'pressures.html';
        if (lower === 'simulator') return 'simulator.html';
        if (lower === 'contacts') return 'contacts.html';
        if (lower === 'help') return 'help.html';
        return name + '.html';
    }

    function getNormalizedFilenameFromPath(pathname) {
        var parts = pathname.split('/');
        if (parts.length && parts[0] === '') parts.shift();
        if (['ka', 'de', 'ru'].indexOf(parts[0]) !== -1) parts.shift();
        var last = parts.length ? parts[parts.length - 1] : '';
        if (!last || last === '') return 'index.html';
        return mapToFilename(last);
    }

    // ახალი მისამართის აგება ენის შეცვლისას
    function buildTargetPath(currentPathname, targetLang) {
        var isFile = window.location.protocol === 'file:';
        var filename = getNormalizedFilenameFromPath(currentPathname);
        
        if (isFile) {
            var parts = currentPathname.split('/').filter(Boolean);
            var hasLang = parts.indexOf('ka') !== -1 || parts.indexOf('de') !== -1 || parts.indexOf('ru') !== -1;
            if (!hasLang) {
                if (targetLang === 'en') return filename;
                return targetLang + '/' + filename;
            } else {
                if (targetLang === 'en') return '../' + filename;
                return '../' + targetLang + '/' + filename;
            }
        }
        
        if (targetLang === 'en') return '/' + filename;
        return '/' + targetLang + '/' + filename;
    }

    // SEO და კანონიკური ლინკების მართვა
    function ensureCanonicalAndAlternates() {
        var head = document.getElementsByTagName('head')[0];
        if (!head) return;
        var isFile = window.location.protocol === 'file:';
        var origin = isFile ? 'https://gas-flows.com' : (window.location.origin || (window.location.protocol + '//' + window.location.host));
        var pathname = window.location.pathname;
        var currentLang = detectLangFromPath(pathname);

        document.documentElement.setAttribute('lang', currentLang);

        var canonicalHref = origin + buildTargetPath(pathname, currentLang).replace(/^\./, '');
        var canonical = head.querySelector('link[rel="canonical"]');
        if (!canonical) {
            canonical = document.createElement('link');
            canonical.setAttribute('rel', 'canonical');
            head.appendChild(canonical);
        }
        canonical.setAttribute('href', canonicalHref);

        // ძველი ალტერნატიული ლინკების წაშლა
        [].slice.call(head.querySelectorAll('link[rel="alternate"][hreflang]')).forEach(function(n) { head.removeChild(n); });

        // ახალი ალტერნატიული ლინკების დამატება (მათ შორის ქართულის)
        ['en','ka','de','ru'].forEach(function(lang) {
            var link = document.createElement('link');
            link.setAttribute('rel', 'alternate');
            link.setAttribute('hreflang', lang);
            link.setAttribute('href', origin + buildTargetPath(pathname, lang).replace(/^\./, ''));
            head.appendChild(link);
        });
        
        var xdef = document.createElement('link');
        xdef.setAttribute('rel', 'alternate');
        xdef.setAttribute('hreflang', 'x-default');
        xdef.setAttribute('href', origin + buildTargetPath(pathname, 'en').replace(/^\./, ''));
        head.appendChild(xdef);
    }

    // შიდა ლინკების გადაწერა მიმდინარე ენის მიხედვით
    function rewriteInternalLinks(currentLang) {
        if (window.location.protocol === 'file:') return;
        var anchors = document.getElementsByTagName('a');
        var origin = window.location.origin;
        for (var i = 0; i < anchors.length; i++) {
            var a = anchors[i];
            var href = a.getAttribute('href');
            if (!href) continue;
            if (href.startsWith('http') || href.startsWith('mailto:') || href.startsWith('#')) continue;
            
            var url;
            try { url = new URL(href, window.location.href); } catch (_) { continue; }
            if (origin && url.origin && url.origin !== origin) continue;
            
            var targetFile = mapToFilename(url.pathname.split('/').pop());
            if (currentLang === 'en') {
                a.setAttribute('href', '/' + targetFile);
            } else {
                a.setAttribute('href', '/' + currentLang + '/' + targetFile);
            }
        }
    }

    // ენის გადამრთველი ღილაკის ჩამატება კუთხეში
    function injectCornerDropdown(currentLang) {
        if (document.getElementById('lang-switcher')) return;
        
        var p = (window.location.pathname || '').toLowerCase();
        if (p.indexOf('help.html') !== -1) return; // არ გვინდა help გვერდზე

        var wrap = document.createElement('div');
        wrap.id = 'lang-switcher';
        wrap.className = 'lang-switcher';
        
        var select = document.createElement('select');
        select.setAttribute('aria-label', 'Language / ენა');
        
        // ენების სია
        var langs = [
            {code: 'ka', label: 'KA (ქართული)'},
            {code: 'en', label: 'EN'},
            {code: 'de', label: 'DE'},
            {code: 'ru', label: 'RU'}
        ];

        langs.forEach(function(langObj) {
            var o = document.createElement('option');
            o.value = langObj.code;
            o.textContent = langObj.label;
            select.appendChild(o);
        });

        select.value = currentLang;
        select.addEventListener('change', function() {
            var lang = this.value;
            setStoredLang(lang);
            window.location.href = buildTargetPath(window.location.pathname, lang);
        });
        
        wrap.appendChild(select);
        document.body.appendChild(wrap);
    }

    // ავტომატური გადამისამართება პირველი სტუმრობისას (ბრაუზერის ენის მიხედვით)
    function firstVisitRedirectIfNeeded(currentLang) {
        if (getStoredLang()) return; 
        var nav = (navigator.language || navigator.userLanguage || '').toLowerCase();
        var want = 'en';
        if (nav.indexOf('ka') === 0) want = 'ka';
        else if (nav.indexOf('de') === 0) want = 'de';
        else if (nav.indexOf('ru') === 0) want = 'ru';

        if (currentLang === 'en' && want !== 'en') {
            setStoredLang(want);
            window.location.replace(buildTargetPath(window.location.pathname, want));
        }
    }

    // ინიციალიზაცია
    (function init() {
        var currentLang = detectLangFromPath(window.location.pathname);
        var stored = getStoredLang();
        
        if (stored && stored !== currentLang && ['en','ka','de','ru'].indexOf(stored) !== -1) {
            var target = buildTargetPath(window.location.pathname, stored);
            if (window.location.protocol === 'file:') {
                window.location.href = target;
            } else {
                window.location.replace(target);
            }
            return;
        }
        firstVisitRedirectIfNeeded(currentLang);
    })();

    document.addEventListener('DOMContentLoaded', function() {
        var currentLang = detectLangFromPath(window.location.pathname);
        ensureCanonicalAndAlternates();
        injectCornerDropdown(currentLang);
        rewriteInternalLinks(currentLang);
    });
})();