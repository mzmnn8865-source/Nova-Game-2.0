/* ============================================================
   نووا گیم — Script
   Author: Aria Azizi
   v3.1 — Clean & Functional
   ============================================================ */

'use strict';

/* ═══════════════════════════════════
   ابزارها
═══════════════════════════════════ */
const $  = (s, c = document) => c.querySelector(s);
const $$ = (s, c = document) => Array.from(c.querySelectorAll(s));

const store = {
    get(k, fb) {
        try { const v = localStorage.getItem(k); return v === null ? fb : v; }
        catch (e) { return fb; }
    },
    set(k, v) {
        try { localStorage.setItem(k, v); } catch (e) {}
    },
    del(k) {
        try { localStorage.removeItem(k); } catch (e) {}
    },
    json(k, fb) {
        try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : fb; }
        catch (e) { return fb; }
    }
};

function hashPass(str) {
    let h = 5381;
    for (let i = 0; i < str.length; i++) {
        h = ((h << 5) + h) + str.charCodeAt(i);
        h = h & h;
    }
    return 'h_' + Math.abs(h).toString(36) + '_' + str.length;
}

function faNum(n) {
    return String(n).replace(/\d/g, function (d) { return '۰۱۲۳۴۵۶۷۸۹'[d]; });
}

function uid(p) {
    return (p || '') + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

function escapeHtml(str) {
    const d = document.createElement('div');
    d.textContent = str || '';
    return d.innerHTML;
}

function stripHtml(html) {
    const d = document.createElement('div');
    d.innerHTML = html || '';
    return d.textContent || '';
}

function timeAgo(ts) {
    const d = (Date.now() - ts) / 1000;
    if (d < 60) return 'همین الان';
    if (d < 3600) return faNum(Math.floor(d / 60)) + ' دقیقه پیش';
    if (d < 86400) return faNum(Math.floor(d / 3600)) + ' ساعت پیش';
    if (d < 604800) return faNum(Math.floor(d / 86400)) + ' روز پیش';
    try { return new Date(ts).toLocaleDateString('fa-IR'); } catch (e) { return ''; }
}

function parseMentions(text) {
    return text.replace(/@([a-zA-Z][a-zA-Z0-9_]{2,19})/g, function (m, u) {
        return '<span class="mention" data-username="' + u.toLowerCase() + '">@' + u + '</span>';
    });
}

function fileToBase64(file) {
    return new Promise(function (resolve, reject) {
        if (file.size > 500 * 1024) { reject('حجم فایل زیاده. حداکثر ۵۰۰ کیلوبایت.'); return; }
        const reader = new FileReader();
        reader.onload = function () { resolve(reader.result); };
        reader.onerror = function () { reject('خطا در خواندن فایل'); };
        reader.readAsDataURL(file);
    });
}

/* ═══════════════════════════════════
   Toast
═══════════════════════════════════ */
let toastTimer;
function toast(msg, duration) {
    const el = $('#toast');
    if (!el) return;
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { el.classList.remove('show'); }, duration || 2200);
}

/* ═══════════════════════════════════
   Storage
═══════════════════════════════════ */
const DB = {
    K: {
        USERS: 'nova.users',
        POSTS: 'nova.posts',
        SESSION: 'nova.session',
        MESSAGES: 'nova.messages',
        NOTIFS: 'nova.notifs',
        GROUPS: 'nova.groups',
        ACTIVITY: 'nova.activity'
    },
    getUsers()    { return store.json(this.K.USERS, []); },
    setUsers(v)   { store.set(this.K.USERS, JSON.stringify(v)); },
    getPosts()    { return store.json(this.K.POSTS, []); },
    setPosts(v)   { store.set(this.K.POSTS, JSON.stringify(v)); },
    getSession()  { return store.json(this.K.SESSION, null); },
    setSession(v) { store.set(this.K.SESSION, JSON.stringify(v)); },
    clearSession(){ store.del(this.K.SESSION); },
    getMessages() { return store.json(this.K.MESSAGES, []); },
    setMessages(v){ store.set(this.K.MESSAGES, JSON.stringify(v)); },
    getNotifs()   { return store.json(this.K.NOTIFS, []); },
    setNotifs(v)  { store.set(this.K.NOTIFS, JSON.stringify(v)); },
    getGroups()   { return store.json(this.K.GROUPS, []); },
    setGroups(v)  { store.set(this.K.GROUPS, JSON.stringify(v)); },
    getActivity() { return store.json(this.K.ACTIVITY, []); },
    setActivity(v){ store.set(this.K.ACTIVITY, JSON.stringify(v)); }
};

/* ═══════════════════════════════════
   State
═══════════════════════════════════ */
const State = {
    theme: store.get('nova.theme', 'light'),
    perf: store.get('nova.perf', 'auto'),
    user: null,
    page: 'home',
    pageData: null,
    postFilter: 'all',
    timeFilter: 'day',
    groupFilter: 'all'
};

/* ═══════════════════════════════════
   Performance
═══════════════════════════════════ */
function detectPerf() {
    let score = 0;
    const cores = navigator.hardwareConcurrency || 2;
    const ram = navigator.deviceMemory || 4;
    const isTouch = matchMedia('(hover: none)').matches || navigator.maxTouchPoints > 1;
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

    let gpuScore = 0;
    try {
        const c = document.createElement('canvas');
        const gl = c.getContext('webgl');
        if (gl) {
            const dbg = gl.getExtension('WEBGL_debug_renderer_info');
            const r = (dbg ? gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) : '').toLowerCase();
            if (r.indexOf('rtx') > -1 || r.indexOf('apple m') > -1) gpuScore = 3;
            else if (r.indexOf('radeon rx') > -1) gpuScore = 2;
            else if (r.indexOf('intel') > -1) gpuScore = -1;
            else if (r.indexOf('swiftshader') > -1 || r.indexOf('llvmpipe') > -1) gpuScore = -3;
        }
    } catch (e) {}

    if (cores >= 8) score += 3;
    else if (cores >= 6) score += 2;
    else if (cores >= 4) score += 1;

    if (ram >= 8) score += 3;
    else if (ram >= 4) score += 2;
    else if (ram >= 2) score += 1;

    score += gpuScore;
    if (!isTouch) score += 2;
    if (reduce) score -= 4;
    if (innerWidth < 480) score -= 1;

    if (score <= -2) return 'ultra-low';
    if (score <= 1) return 'low';
    if (score <= 3) return 'mid';
    if (score >= 12) return 'ultra';
    return 'high';
}

/* ═══════════════════════════════════
   Theme
═══════════════════════════════════ */
function applyTheme(theme) {
    let final = theme;
    if (theme === 'auto') {
        const h = new Date().getHours();
        final = (h >= 7 && h < 19) ? 'light' : 'dark';
    }

    document.documentElement.dataset.theme = theme;
    document.documentElement.classList.toggle('light', final === 'light');
    document.documentElement.classList.toggle('dark', final === 'dark');
    document.documentElement.style.colorScheme = final;
    State.theme = theme;
    store.set('nova.theme', theme);

    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.content = final === 'light' ? '#f5f7fb' : '#0a0a14';

    /* آیکون */
    const icon = $('#themeIcon');
    if (icon) {
        const icons = {
            light: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
            dark: '<path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/>',
            auto: '<circle cx="12" cy="12" r="9"/><path d="M12 3v18"/>'
        };
        icon.innerHTML = icons[theme] || icons.light;
    }
}

function flipTheme() {
    const order = ['light', 'dark', 'auto'];
    const idx = order.indexOf(State.theme);
    const next = order[(idx + 1) % order.length];
    applyTheme(next);

    const labels = { light: 'حالت روز', dark: 'حالت شب', auto: 'حالت خودکار' };
    toast(labels[next]);
}

setInterval(function () {
    if (State.theme === 'auto') applyTheme('auto');
}, 60000);

/* ═══════════════════════════════════
   Auth
═══════════════════════════════════ */
function getCurrentUser() {
    const session = DB.getSession();
    if (!session) return null;
    const users = DB.getUsers();
    for (let i = 0; i < users.length; i++) {
        if (users[i].id === session.userId) return users[i];
    }
    return null;
}

function registerUser(data) {
    const users = DB.getUsers();
    const clean = data.username.toLowerCase().trim();

    if (!/^[a-z][a-z0-9_]{2,19}$/.test(clean)) {
        return { ok: false, error: 'نام کاربری فقط با حروف انگلیسی، اعداد یا _' };
    }
    for (let i = 0; i < users.length; i++) {
        if (users[i].username === clean) {
            return { ok: false, error: 'این نام کاربری گرفته شده' };
        }
    }
    if (data.password.length < 6) {
        return { ok: false, error: 'رمز باید حداقل ۶ کاراکتر باشه' };
    }

    const user = {
        id: uid('u_'),
        username: clean,
        displayName: data.displayName.trim() || clean,
        passHash: hashPass(data.password),
        platform: data.platform || 'pc',
        avatar: null,
        cover: null,
        bio: '',
        title: '',
        firstName: '',
        lastName: '',
        birthday: '',
        website: '',
        favGames: '',
        favMovies: '',
        instagram: '',
        telegram: '',
        discord: '',
        role: 'user',
        verified: false,
        level: 1,
        xp: 0,
        joinedAt: Date.now(),
        lastSeen: Date.now(),
        friends: [],
        friendRequests: [],
        blocked: [],
        groups: []
    };

    users.push(user);

    /* اولین کاربر = مدیر */
    if (users.length === 1) {
        user.role = 'admin';
        user.verified = true;
    }

    DB.setUsers(users);
    DB.setSession({ userId: user.id, ts: Date.now() });
    State.user = user;

    return { ok: true, user: user };
}

function loginUser(username, password) {
    const users = DB.getUsers();
    const clean = username.toLowerCase().trim();
    let user = null;

    for (let i = 0; i < users.length; i++) {
        if (users[i].username === clean) { user = users[i]; break; }
    }

    if (!user) return { ok: false, error: 'کاربری با این نام پیدا نشد' };
    if (user.passHash !== hashPass(password)) return { ok: false, error: 'رمز اشتباهه' };

    user.lastSeen = Date.now();
    DB.setUsers(users);
    DB.setSession({ userId: user.id, ts: Date.now() });
    State.user = user;

    return { ok: true, user: user };
}

function logoutUser() {
    DB.clearSession();
    State.user = null;
    updateAuthUI();
    closeUserPanel();
    toast('خارج شدی');
}

/* ═══════════════════════════════════
   Update UI
═══════════════════════════════════ */
function updateAuthUI() {
    const u = State.user;
    const guest = $('#userBtnGuest');
    const logged = $('#userBtn');
    const avatar = $('#navAvatar');
    const drawerUser = $('#drawerUser');
    const drawerAvatar = $('#drawerAvatar');
    const drawerName = $('#drawerName');
    const drawerUsername = $('#drawerUsername');
    const drawerLogin = $('#drawerLoginBtn');
    const createGroupBtn = $('#createGroupBtn');

    if (!guest || !logged) return;

    if (u) {
        guest.hidden = true;
        logged.hidden = false;

        const initial = (u.displayName || 'U')[0].toUpperCase();
        if (avatar) avatar.innerHTML = u.avatar ? '<img src="' + u.avatar + '">' : initial;

        if (drawerUser) drawerUser.hidden = false;
        if (drawerAvatar) drawerAvatar.innerHTML = u.avatar ? '<img src="' + u.avatar + '">' : initial;
        if (drawerName) drawerName.textContent = u.displayName;
        if (drawerUsername) drawerUsername.textContent = '@' + u.username;
        if (drawerLogin) drawerLogin.hidden = true;
        if (createGroupBtn) createGroupBtn.hidden = u.role !== 'admin';

        updateBadges();
    } else {
        guest.hidden = false;
        logged.hidden = true;
        if (drawerUser) drawerUser.hidden = true;
        if (drawerLogin) drawerLogin.hidden = false;
        if (createGroupBtn) createGroupBtn.hidden = true;
    }
}

function updateBadges() {
    if (!State.user) return;
    const upNotifCount = $('#upNotifCount');
    const upMsgCount = $('#upMsgCount');
    const upFriendCount = $('#upFriendCount');

    const notifs = DB.getNotifs().filter(function (n) {
        return n.userId === State.user.id && !n.read;
    });
    const msgs = DB.getMessages().filter(function (m) {
        return m.to === State.user.id && !m.read;
    });
    const reqs = (State.user.friendRequests || []).length;

    if (upNotifCount) {
        upNotifCount.hidden = notifs.length === 0;
        upNotifCount.textContent = faNum(notifs.length);
    }
    if (upMsgCount) {
        upMsgCount.hidden = msgs.length === 0;
        upMsgCount.textContent = faNum(msgs.length);
    }
    if (upFriendCount) {
        upFriendCount.hidden = reqs === 0;
        upFriendCount.textContent = faNum(reqs);
    }
}

/* ═══════════════════════════════════
   Router (SPA)
═══════════════════════════════════ */
function showPage(page, data) {
    $$('.page').forEach(function (p) { p.classList.remove('active'); });
    const el = document.getElementById('page-' + page);
    if (el) el.classList.add('active');

    State.page = page;
    State.pageData = data || null;

    window.scrollTo(0, 0);

    const titles = {
        home: 'نووا گیم',
        post: 'پست',
        groups: 'گروه‌ها',
        group: 'چت',
        users: 'کاربران',
        activity: 'فعالیت‌ها',
        about: 'درباره ما',
        cinema: 'سینما',
        games: 'بازی'
    };
    document.title = (titles[page] || 'نووا گیم') + ' | Nova Game';

    if (page === 'home')     renderHome();
    if (page === 'post')     renderPostPage(data);
    if (page === 'groups')   renderGroupsPage();
    if (page === 'group')    renderGroupPage(data);
    if (page === 'users')    renderUsersPage();
    if (page === 'activity') renderActivityPage();
}

/* ═══════════════════════════════════
   Home
═══════════════════════════════════ */
function renderHome() {
    renderPosts();
    renderTrending();
    renderHomeGroups();
}

function getFilteredPosts() {
    let posts = DB.getPosts().filter(function (p) { return p.status === 'published'; });

    if (State.postFilter === 'editor') {
        posts = posts.filter(function (p) { return p.editorChoice === true; });
    } else if (State.postFilter === 'discussed') {
        posts.sort(function (a, b) {
            return ((b.comments || []).length) - ((a.comments || []).length);
        });
    } else if (State.postFilter === 'popular') {
        posts.sort(function (a, b) { return (b.views || 0) - (a.views || 0); });
    } else {
        posts.sort(function (a, b) { return b.createdAt - a.createdAt; });
    }

    return posts;
}

function renderPosts() {
    const grid = $('#postsGrid');
    if (!grid) return;

    const posts = getFilteredPosts();

    if (!posts.length) {
        grid.innerHTML = '<div class="empty-state"><h3>هنوز پستی نیست</h3><p>وقتی اولین پست منتشر بشه، اینجا نشون داده می‌شه</p></div>';
        return;
    }

    grid.innerHTML = '';
    const limit = Math.min(posts.length, 7);
    for (let i = 0; i < limit; i++) {
        grid.appendChild(createPostCard(posts[i]));
    }
}

function createPostCard(post) {
    const card = document.createElement('article');
    card.className = 'post-card';

    const catLabel = {
        news: 'خبر', review: 'نقد', guide: 'راهنما', cinema: 'سینما', game: 'بازی'
    }[post.category] || 'خبر';

    let coverHtml = '';
    if (post.cover) {
        coverHtml = '<img src="' + post.cover + '" alt="">';
    }

    let scoreHtml = '';
    if (post.score) {
        scoreHtml = '<span class="post-card-badge" style="left:12px;right:auto;">' + faNum(post.score) + '/۱۰</span>';
    }

    card.innerHTML =
        '<div class="post-card-cover" style="' + (post.cover ? '' : 'background:linear-gradient(135deg,var(--accent),var(--accent-2));') + '">' +
            coverHtml +
            '<span class="post-card-badge">' + catLabel + '</span>' +
            scoreHtml +
        '</div>' +
        '<div class="post-card-body">' +
            '<h3 class="post-card-title">' + escapeHtml(post.title) + '</h3>' +
            '<p class="post-card-excerpt">' + escapeHtml(post.excerpt || stripHtml(post.content).slice(0, 120)) + '</p>' +
            '<div class="post-card-meta">' +
                '<span>' + timeAgo(post.createdAt) + '</span>' +
                '<span>·</span>' +
                '<span>' + faNum(post.views || 0) + ' بازدید</span>' +
            '</div>' +
        '</div>';

    card.addEventListener('click', function () {
        showPage('post', post.id);
    });

    return card;
}

function renderTrending() {
    const grid = $('#trendingGrid');
    if (!grid) return;

    let posts = DB.getPosts().filter(function (p) { return p.status === 'published'; });
    const now = Date.now();
    const ranges = { day: 86400000, week: 604800000, month: 2592000000 };
    const range = ranges[State.timeFilter] || ranges.day;

    posts = posts.filter(function (p) { return (now - p.createdAt) < range; });
    posts.sort(function (a, b) { return (b.views || 0) - (a.views || 0); });

    if (!posts.length) {
        grid.innerHTML = '<div class="empty-state"><h3>چیزی برای نمایش نیست</h3><p>توی این بازه زمانی پستی منتشر نشده</p></div>';
        return;
    }

    grid.innerHTML = '';
    const limit = Math.min(posts.length, 6);
    for (let i = 0; i < limit; i++) {
        grid.appendChild(createPostCard(posts[i]));
    }
}

function renderHomeGroups() {
    const grid = $('#homeGroupsGrid');
    if (!grid) return;

    const groups = DB.getGroups().filter(function (g) { return g.type === 'public'; }).slice(0, 3);

    if (!groups.length) {
        grid.innerHTML = '<div class="empty-state"><h3>هنوز گروهی نیست</h3><p>به زودی گروه‌های عمومی اضافه می‌شن</p></div>';
        return;
    }

    grid.innerHTML = '';
    groups.forEach(function (g) { grid.appendChild(createGroupCard(g)); });
}

/* ═══════════════════════════════════
   Post Page
═══════════════════════════════════ */
function renderPostPage(postId) {
    const box = $('#postPageContent');
    if (!box) return;

    const posts = DB.getPosts();
    let post = null;
    for (let i = 0; i < posts.length; i++) {
        if (posts[i].id === postId) { post = posts[i]; break; }
    }

    if (!post) {
        box.innerHTML = '<div class="empty-state"><h3>پست پیدا نشد</h3></div>';
        return;
    }

    post.views = (post.views || 0) + 1;
    DB.setPosts(posts);

    const catLabel = {
        news: 'خبر', review: 'نقد', guide: 'راهنما', cinema: 'سینما', game: 'بازی'
    }[post.category] || 'خبر';

    const comments = post.comments || [];

    let coverHtml = '';
    if (post.cover) {
        coverHtml = '<div class="post-page-cover"><img src="' + post.cover + '" alt=""></div>';
    }

    const metaCat = catLabel +
        (post.score ? ' · ' + faNum(post.score) + '/۱۰' : '') +
        (post.editorChoice ? ' · انتخاب سردبیر' : '');

    let commentFormHtml = '';
    if (State.user) {
        commentFormHtml =
            '<div class="comment-form">' +
                '<div class="comment-editor" id="commentEditor" contenteditable="true" data-placeholder="نظرت رو بنویس"></div>' +
                '<div class="comment-toolbar">' +
                    '<button type="button" data-cmd="bold" title="ضخیم"><b>B</b></button>' +
                    '<button type="button" data-cmd="italic" title="کج"><i>I</i></button>' +
                    '<button type="button" data-cmd="underline" title="زیرخط"><u>U</u></button>' +
                    '<span class="sep"></span>' +
                    '<button type="button" id="btnSpoiler" title="اسپویلر">اسپویلر</button>' +
                    '<button type="button" id="btnCode" title="کد">کد</button>' +
                    '<span class="sep"></span>' +
                    '<button type="button" id="btnMention" title="منشن">@</button>' +
                    '<button type="button" id="btnColorPicker" title="رنگ">رنگ</button>' +
                '</div>' +
                '<div class="color-picker" id="colorPicker" hidden>' +
                    '<div class="color-dot" style="background:#0a0f1e;" data-color="#0a0f1e"></div>' +
                    '<div class="color-dot" style="background:#dc2626;" data-color="#dc2626"></div>' +
                    '<div class="color-dot" style="background:#ea580c;" data-color="#ea580c"></div>' +
                    '<div class="color-dot" style="background:#d97706;" data-color="#d97706"></div>' +
                    '<div class="color-dot" style="background:#16a34a;" data-color="#16a34a"></div>' +
                    '<div class="color-dot" style="background:#2563eb;" data-color="#2563eb"></div>' +
                    '<div class="color-dot" style="background:#7c3aed;" data-color="#7c3aed"></div>' +
                    '<div class="color-dot" style="background:#d1006b;" data-color="#d1006b"></div>' +
                '</div>' +
                '<div class="comment-actions">' +
                    '<small style="font-size:11px;color:var(--tx-mute);"><span id="charCount">۰</span> کاراکتر</small>' +
                    '<button class="btn-primary small" id="submitComment" type="button">ارسال</button>' +
                '</div>' +
            '</div>';
    } else {
        commentFormHtml = '<div class="comment-form" style="text-align:center;padding:24px;">' +
            '<p style="font-size:13px;color:var(--tx-mute);margin-bottom:10px;">برای کامنت گذاشتن اول وارد شو</p>' +
            '<button class="btn-primary small" id="loginToComment" type="button">ورود</button>' +
            '</div>';
    }

    let commentsHtml = '';
    if (comments.length) {
        for (let i = 0; i < comments.length; i++) {
            commentsHtml += renderComment(comments[i], post.id);
        }
    } else {
        commentsHtml = '<p style="text-align:center;color:var(--tx-mute);padding:20px;font-size:13px;">هنوز نظری نیست. اولین نفر باش</p>';
    }

    box.innerHTML =
        coverHtml +
        '<div class="post-page-header">' +
            '<span class="post-page-cat">' + metaCat + '</span>' +
            '<h1 class="post-page-title">' + escapeHtml(post.title) + '</h1>' +
            '<div class="post-page-meta">' +
                '<div class="author">' +
                    '<div class="user-avatar">' + (post.authorAvatar ? '<img src="' + post.authorAvatar + '">' : ((post.authorName || 'N')[0])) + '</div>' +
                    '<strong>' + escapeHtml(post.authorName || 'ناشناس') + '</strong>' +
                '</div>' +
                '<span>·</span>' +
                '<span>' + timeAgo(post.createdAt) + '</span>' +
                '<span>·</span>' +
                '<span>' + faNum(post.views) + ' بازدید</span>' +
            '</div>' +
        '</div>' +
        '<div class="post-page-body">' + post.content + '</div>' +
        '<div class="comments-section">' +
            '<div class="comments-head"><h3>نظرات <span>(' + faNum(comments.length) + ')</span></h3></div>' +
            commentFormHtml +
            '<div class="comment-list" id="commentList">' + commentsHtml + '</div>' +
        '</div>';

    initCommentEditor(post.id);
}

function renderComment(comment, postId) {
    const users = DB.getUsers();
    let user = null;
    for (let i = 0; i < users.length; i++) {
        if (users[i].id === comment.userId) { user = users[i]; break; }
    }

    const name = user ? user.displayName : (comment.userName || 'ناشناس');
    const avatar = user ? user.avatar : comment.userAvatar;
    const initial = name[0].toUpperCase();

    const likes = comment.likes || [];
    const dislikes = comment.dislikes || [];
    const userLiked = State.user && likes.indexOf(State.user.id) > -1;
    const userDisliked = State.user && dislikes.indexOf(State.user.id) > -1;

    let reactionsHtml = '';
    if (likes.length || dislikes.length) {
        let avatars = '';
        const limit = Math.min(likes.length, 5);
        for (let i = 0; i < limit; i++) {
            let lu = null;
            for (let j = 0; j < users.length; j++) {
                if (users[j].id === likes[i]) { lu = users[j]; break; }
            }
            if (lu) {
                const init = (lu.displayName || 'U')[0].toUpperCase();
                avatars += '<div class="reaction-avatar" title="' + escapeHtml(lu.displayName) + '">' +
                    (lu.avatar ? '<img src="' + lu.avatar + '">' : init) + '</div>';
            }
        }
        reactionsHtml = '<div class="reactions-list">' + avatars +
            (likes.length > 5 ? '<span class="reaction-count">+' + faNum(likes.length - 5) + '</span>' : '') +
            (likes.length ? '<span class="reaction-count">' + faNum(likes.length) + ' لایک</span>' : '') +
            '</div>';
    }

    let repliesHtml = '';
    if (comment.replies && comment.replies.length) {
        repliesHtml = '<div class="comment-replies">';
        for (let i = 0; i < comment.replies.length; i++) {
            repliesHtml += renderComment(comment.replies[i], postId);
        }
        repliesHtml += '</div>';
    }

    const canDelete = State.user && (State.user.id === comment.userId || State.user.role === 'admin');

    return '<div class="comment-item" data-comment-id="' + comment.id + '">' +
        '<div class="comment-item-header">' +
            '<div class="user-avatar">' + (avatar ? '<img src="' + avatar + '">' : initial) + '</div>' +
            '<div class="user-name">' +
                '<strong>' + escapeHtml(name) + '</strong>' +
                '<small>@' + escapeHtml(user ? user.username : 'user') + '</small>' +
            '</div>' +
            '<span class="time">' + timeAgo(comment.createdAt) + '</span>' +
        '</div>' +
        '<div class="comment-item-body">' + comment.content + '</div>' +
        '<div class="comment-item-footer">' +
            '<button class="comment-btn ' + (userLiked ? 'liked' : '') + '" data-like="' + comment.id + '" type="button">' +
                'لایک ' + faNum(likes.length) +
            '</button>' +
            '<button class="comment-btn ' + (userDisliked ? 'disliked' : '') + '" data-dislike="' + comment.id + '" type="button">' +
                'دیس‌لایک ' + faNum(dislikes.length) +
            '</button>' +
            '<button class="comment-btn" data-reply="' + comment.id + '" type="button">پاسخ</button>' +
            (canDelete ? '<button class="comment-btn" data-delete="' + comment.id + '" type="button">حذف</button>' : '') +
        '</div>' +
        reactionsHtml +
        repliesHtml +
    '</div>';
}

function initCommentEditor(postId) {
    const editor = $('#commentEditor');
    if (!editor) {
        $('#loginToComment') && $('#loginToComment').addEventListener('click', function () {
            openModal('authOverlay');
        });
        initCommentActions(postId);
        return;
    }

    const submitBtn = $('#submitComment');
    const charCount = $('#charCount');

    $$('.comment-toolbar button[data-cmd]').forEach(function (btn) {
        btn.addEventListener('click', function (e) {
            e.preventDefault();
            document.execCommand(btn.dataset.cmd, false, null);
            editor.focus();
        });
    });

    const btnSpoiler = $('#btnSpoiler');
    if (btnSpoiler) {
        btnSpoiler.addEventListener('click', function () {
            const sel = window.getSelection().toString() || 'متن مخفی';
            document.execCommand('insertHTML', false,
                '<span class="spoiler" onclick="this.classList.toggle(\'revealed\')">' + escapeHtml(sel) + '</span>');
            editor.focus();
        });
    }

    const btnCode = $('#btnCode');
    if (btnCode) {
        btnCode.addEventListener('click', function () {
            const t = prompt('کد:');
            if (t) document.execCommand('insertHTML', false, '<code>' + escapeHtml(t) + '</code>');
            editor.focus();
        });
    }

    const btnMention = $('#btnMention');
    if (btnMention) {
        btnMention.addEventListener('click', function () {
            const users = DB.getUsers().slice(0, 8);
            let menu = '';
            for (let i = 0; i < users.length; i++) {
                menu += users[i].username + (i < users.length - 1 ? '، ' : '');
            }
            const u = prompt('نام کاربری رو بنویس:\n' + menu);
            if (u) document.execCommand('insertHTML', false, '@' + u + ' ');
            editor.focus();
        });
    }

    const btnColorPicker = $('#btnColorPicker');
    if (btnColorPicker) {
        btnColorPicker.addEventListener('click', function () {
            const cp = $('#colorPicker');
            if (cp) cp.hidden = !cp.hidden;
        });
    }

    $$('.color-dot').forEach(function (dot) {
        dot.addEventListener('click', function () {
            document.execCommand('foreColor', false, dot.dataset.color);
            editor.focus();
        });
    });

    editor.addEventListener('input', function () {
        if (charCount) charCount.textContent = faNum(editor.textContent.length);
    });

    if (submitBtn) {
        submitBtn.addEventListener('click', function () {
            const content = editor.innerHTML.trim();
            if (!content || editor.textContent.trim().length < 2) {
                toast('نظرت خیلی کوتاهه');
                return;
            }
            addComment(postId, content);
            editor.innerHTML = '';
            if (charCount) charCount.textContent = '۰';
        });
    }

    initCommentActions(postId);
}

function initCommentActions(postId) {
    const list = $('#commentList');
    if (!list) return;

    list.addEventListener('click', function (e) {
        const like = e.target.closest('[data-like]');
        const dislike = e.target.closest('[data-dislike]');
        const reply = e.target.closest('[data-reply]');
        const del = e.target.closest('[data-delete]');

        if (like) toggleCommentReaction(postId, like.dataset.like, 'like');
        if (dislike) toggleCommentReaction(postId, dislike.dataset.dislike, 'dislike');
        if (reply) replyToComment(postId, reply.dataset.reply);
        if (del && confirm('حذف بشه؟')) deleteComment(postId, del.dataset.delete);
    });
}

function addComment(postId, content) {
    if (!State.user) return;
    const posts = DB.getPosts();
    let post = null;
    for (let i = 0; i < posts.length; i++) {
        if (posts[i].id === postId) { post = posts[i]; break; }
    }
    if (!post) return;

    post.comments = post.comments || [];
    post.comments.push({
        id: uid('c_'),
        userId: State.user.id,
        userName: State.user.displayName,
        userAvatar: State.user.avatar,
        content: parseMentions(content),
        createdAt: Date.now(),
        likes: [],
        dislikes: [],
        replies: []
    });

    DB.setPosts(posts);
    addActivity('comment', State.user.displayName + ' روی پست «' + post.title + '» نظر داد');

    if (post.authorId !== State.user.id) {
        const notifs = DB.getNotifs();
        notifs.push({
            id: uid('n_'),
            userId: post.authorId,
            type: 'comment',
            text: State.user.displayName + ' روی پستت نظر داد',
            link: 'post:' + post.id,
            ts: Date.now(),
            read: false
        });
        DB.setNotifs(notifs);
    }

    toast('نظرت ثبت شد');
    renderPostPage(postId);
}

function toggleCommentReaction(postId, commentId, type) {
    if (!State.user) { toast('اول وارد شو'); return; }
    const posts = DB.getPosts();
    let post = null;
    for (let i = 0; i < posts.length; i++) {
        if (posts[i].id === postId) { post = posts[i]; break; }
    }
    if (!post) return;

    function findComment(list) {
        for (let i = 0; i < list.length; i++) {
            if (list[i].id === commentId) return list[i];
            if (list[i].replies && list[i].replies.length) {
                const f = findComment(list[i].replies);
                if (f) return f;
            }
        }
        return null;
    }

    const comment = findComment(post.comments || []);
    if (!comment) return;

    comment.likes = comment.likes || [];
    comment.dislikes = comment.dislikes || [];

    if (type === 'like') {
        comment.dislikes = comment.dislikes.filter(function (id) { return id !== State.user.id; });
        if (comment.likes.indexOf(State.user.id) > -1) {
            comment.likes = comment.likes.filter(function (id) { return id !== State.user.id; });
        } else {
            comment.likes.push(State.user.id);
        }
    } else {
        comment.likes = comment.likes.filter(function (id) { return id !== State.user.id; });
        if (comment.dislikes.indexOf(State.user.id) > -1) {
            comment.dislikes = comment.dislikes.filter(function (id) { return id !== State.user.id; });
        } else {
            comment.dislikes.push(State.user.id);
        }
    }

    DB.setPosts(posts);
    renderPostPage(postId);
}

function replyToComment(postId, commentId) {
    const text = prompt('پاسخت رو بنویس:');
    if (!text || !text.trim()) return;
    if (!State.user) return;

    const posts = DB.getPosts();
    let post = null;
    for (let i = 0; i < posts.length; i++) {
        if (posts[i].id === postId) { post = posts[i]; break; }
    }
    if (!post) return;

    function findComment(list) {
        for (let i = 0; i < list.length; i++) {
            if (list[i].id === commentId) return list[i];
            if (list[i].replies && list[i].replies.length) {
                const f = findComment(list[i].replies);
                if (f) return f;
            }
        }
        return null;
    }

    const comment = findComment(post.comments || []);
    if (!comment) return;

    comment.replies = comment.replies || [];
    comment.replies.push({
        id: uid('c_'),
        userId: State.user.id,
        userName: State.user.displayName,
        userAvatar: State.user.avatar,
        content: escapeHtml(text),
        createdAt: Date.now(),
        likes: [],
        dislikes: [],
        replies: []
    });

    DB.setPosts(posts);
    renderPostPage(postId);
}

function deleteComment(postId, commentId) {
    const posts = DB.getPosts();
    let post = null;
    for (let i = 0; i < posts.length; i++) {
        if (posts[i].id === postId) { post = posts[i]; break; }
    }
    if (!post) return;

    function removeFrom(list) {
        for (let i = 0; i < list.length; i++) {
            if (list[i].id === commentId) { list.splice(i, 1); return true; }
            if (list[i].replies && list[i].replies.length) {
                if (removeFrom(list[i].replies)) return true;
            }
        }
        return false;
    }

    if (removeFrom(post.comments || [])) {
        DB.setPosts(posts);
        renderPostPage(postId);
        toast('حذف شد');
    }
}

/* ═══════════════════════════════════
   Groups
═══════════════════════════════════ */
function renderGroupsPage() {
    const grid = $('#groupsGrid');
    if (!grid) return;

    let groups = DB.getGroups();

    if (State.groupFilter === 'public') {
        groups = groups.filter(function (g) { return g.type === 'public'; });
    } else if (State.groupFilter === 'private') {
        groups = groups.filter(function (g) { return g.type === 'private'; });
    } else if (State.groupFilter === 'mine') {
        if (!State.user) groups = [];
        else groups = groups.filter(function (g) {
            return (State.user.groups || []).indexOf(g.id) > -1;
        });
    }

    if (!groups.length) {
        grid.innerHTML = '<div class="empty-state"><h3>گروهی نیست</h3><p>' +
            (State.user && State.user.role === 'admin' ? 'اولین گروه رو بساز' : 'به زودی گروه‌ها اضافه می‌شن') +
            '</p></div>';
        return;
    }

    grid.innerHTML = '';
    groups.forEach(function (g) { grid.appendChild(createGroupCard(g)); });
}

function createGroupCard(group) {
    const card = document.createElement('div');
    card.className = 'group-card';

    const membersCount = (group.members || []).length;
    const typeLabel = group.type === 'public' ? 'عمومی' : 'خصوصی';

    let coverStyle = 'background:linear-gradient(135deg,var(--accent),var(--accent-2));';
    if (group.cover) {
        coverStyle = "background:url('" + group.cover + "') center/cover;";
    }

    card.innerHTML =
        '<div class="group-card-cover" style="' + coverStyle + '">' +
            '<span class="group-card-type ' + group.type + '">' + typeLabel + '</span>' +
        '</div>' +
        '<div class="group-card-body">' +
            '<div class="group-card-avatar">' +
                (group.avatar ? '<img src="' + group.avatar + '">' : (group.name || 'G')[0].toUpperCase()) +
            '</div>' +
            '<div class="group-card-info">' +
                '<h3>' + escapeHtml(group.name) + '</h3>' +
                '<p>' + faNum(membersCount) + ' عضو</p>' +
            '</div>' +
        '</div>';

    card.addEventListener('click', function () { showPage('group', group.id); });
    return card;
}

function renderGroupPage(groupId) {
    const box = $('#groupPageContent');
    if (!box) return;

    const groups = DB.getGroups();
    let group = null;
    for (let i = 0; i < groups.length; i++) {
        if (groups[i].id === groupId) { group = groups[i]; break; }
    }

    if (!group) {
        box.innerHTML = '<div class="empty-state"><h3>گروه پیدا نشد</h3></div>';
        return;
    }

    const uid = State.user ? State.user.id : null;
    const isMember = uid && (group.members || []).indexOf(uid) > -1;
    const isOwner = uid && group.ownerId === uid;
    const isAdmin = uid && (group.admins || []).indexOf(uid) > -1;
    const isMod = uid && (group.mods || []).indexOf(uid) > -1;
    const isBanned = uid && (group.banned || []).indexOf(uid) > -1;

    /* Private + not member */
    if (group.type === 'private' && !isMember && !isOwner && !isAdmin && !isMod) {
        if (isBanned) {
            box.innerHTML = '<div class="empty-state"><h3>از این گروه بن شدی</h3><p>دسترسی نداری</p></div>';
            return;
        }
        box.innerHTML =
            '<div class="empty-state">' +
                '<h3>گروه خصوصی</h3>' +
                '<p>برای ورود باید درخواست بدی</p>' +
                '<button class="btn-primary" id="requestJoinBtn" type="button" style="margin-top:14px;">درخواست عضویت</button>' +
            '</div>';

        const btn = $('#requestJoinBtn');
        if (btn) btn.addEventListener('click', function () { requestJoinGroup(groupId); });
        return;
    }

    const messages = group.messages || [];
    const visible = messages.slice(-20);

    let messagesHtml = '';
    if (messages.length > 20) {
        messagesHtml += '<button class="chat-load-more" id="loadMoreMsgs" type="button">نمایش ۲۰ پیام قدیمی‌تر</button>';
    }

    for (let i = 0; i < visible.length; i++) {
        messagesHtml += renderChatMessage(visible[i], group);
    }

    if (!visible.length) {
        messagesHtml += '<p style="text-align:center;color:var(--tx-mute);padding:30px;font-size:13px;">هنوز پیامی نیست</p>';
    }

    let actionsHtml = '';
    if (isOwner || isAdmin || isMod) {
        actionsHtml += '<button class="btn-ghost small" id="groupSettingsBtn" type="button">تنظیمات</button>';
    }
    if (!isMember && group.type === 'public' && !isBanned) {
        actionsHtml += '<button class="btn-primary small" id="joinGroupBtn" type="button">عضویت</button>';
    }
    if (isBanned) {
        actionsHtml += '<span class="role-badge" style="background:rgba(220,38,38,.15);color:var(--bad);padding:6px 12px;border-radius:100px;font-size:11px;">بن شده</span>';
    }

    let inputHtml = '';
    if (isMember || isOwner || isAdmin || isMod) {
        inputHtml =
            '<div class="chat-input-wrap">' +
                '<div class="chat-editor" id="chatEditor" contenteditable="true" data-placeholder="پیامت رو بنویس"></div>' +
                '<div class="chat-toolbar">' +
                    '<div class="chat-toolbar-left">' +
                        '<button type="button" data-cmd="bold"><b>B</b></button>' +
                        '<button type="button" data-cmd="italic"><i>I</i></button>' +
                        '<button type="button" id="chatSpoiler">اسپویلر</button>' +
                        '<button type="button" id="chatColor">رنگ</button>' +
                        '<button type="button" id="chatImage">تصویر</button>' +
                    '</div>' +
                    '<div class="chat-toolbar-right">' +
                        '<button type="button" class="chat-send-btn" id="chatSend">ارسال</button>' +
                    '</div>' +
                '</div>' +
                '<div class="color-picker" id="chatColorPicker" hidden style="margin-top:8px;">' +
                    '<div class="color-dot" style="background:#dc2626;" data-color="#dc2626"></div>' +
                    '<div class="color-dot" style="background:#ea580c;" data-color="#ea580c"></div>' +
                    '<div class="color-dot" style="background:#d97706;" data-color="#d97706"></div>' +
                    '<div class="color-dot" style="background:#16a34a;" data-color="#16a34a"></div>' +
                    '<div class="color-dot" style="background:#2563eb;" data-color="#2563eb"></div>' +
                    '<div class="color-dot" style="background:#7c3aed;" data-color="#7c3aed"></div>' +
                    '<div class="color-dot" style="background:#d1006b;" data-color="#d1006b"></div>' +
                '</div>' +
            '</div>';
    } else {
        inputHtml = '<div class="chat-input-wrap" style="text-align:center;padding:16px;">' +
            '<p style="font-size:12px;color:var(--tx-mute);">' +
            (isBanned ? 'تو بن شدی، نمی‌تونی پیام بفرستی' : 'عضو نیستی، نمی‌تونی پیام بفرستی') +
            '</p></div>';
    }

    box.innerHTML =
        '<div class="group-page-header">' +
            '<div class="group-page-avatar">' +
                (group.avatar ? '<img src="' + group.avatar + '">' : (group.name || 'G')[0].toUpperCase()) +
            '</div>' +
            '<div class="group-page-info">' +
                '<h1>' + escapeHtml(group.name) + '</h1>' +
                '<p>' +
                    '<span>' + (group.type === 'public' ? 'عمومی' : 'خصوصی') + '</span>' +
                    '<span>' + faNum((group.members || []).length) + ' عضو</span>' +
                    '<span>' + faNum(messages.length) + ' پیام</span>' +
                '</p>' +
            '</div>' +
            '<div class="group-page-actions">' + actionsHtml + '</div>' +
        '</div>' +
        '<div class="chat-box">' +
            '<div class="chat-messages" id="chatMessages">' + messagesHtml + '</div>' +
            inputHtml +
        '</div>';

    initChat(groupId);

    const gsBtn = $('#groupSettingsBtn');
    if (gsBtn) gsBtn.addEventListener('click', function () { openGroupSettings(groupId); });

    const jBtn = $('#joinGroupBtn');
    if (jBtn) jBtn.addEventListener('click', function () { joinGroup(groupId); });

    const lmBtn = $('#loadMoreMsgs');
    if (lmBtn) {
        lmBtn.addEventListener('click', function () {
            toast('به زودی: نمایش پیام‌های قدیمی‌تر');
        });
    }

    /* اسکرول به آخر */
    setTimeout(function () {
        const box2 = $('#chatMessages');
        if (box2) box2.scrollTop = box2.scrollHeight;
    }, 100);
}

function renderChatMessage(msg, group) {
    const users = DB.getUsers();
    let user = null;
    for (let i = 0; i < users.length; i++) {
        if (users[i].id === msg.userId) { user = users[i]; break; }
    }

    const name = user ? user.displayName : (msg.userName || 'ناشناس');
    const avatar = user ? user.avatar : msg.userAvatar;
    const initial = name[0].toUpperCase();

    let roleBadge = '';
    if (group.ownerId === msg.userId) roleBadge = '<span class="role-badge owner">مدیر</span>';
    else if ((group.admins || []).indexOf(msg.userId) > -1) roleBadge = '<span class="role-badge admin">ادمین</span>';
    else if ((group.mods || []).indexOf(msg.userId) > -1) roleBadge = '<span class="role-badge mod">ناظر</span>';

    const userLiked = State.user && (msg.likes || []).indexOf(State.user.id) > -1;
    const userDisliked = State.user && (msg.dislikes || []).indexOf(State.user.id) > -1;

    let imageHtml = '';
    if (msg.image) {
        imageHtml = '<img src="' + msg.image + '" class="chat-msg-image" onclick="window.open(this.src)">';
    }

    let repliesHtml = '';
    if (msg.replies && msg.replies.length) {
        repliesHtml = '<div style="margin-top:8px;padding-right:14px;border-right:2px solid var(--bd);display:flex;flex-direction:column;gap:6px;">';
        for (let i = 0; i < msg.replies.length; i++) {
            repliesHtml += '<div style="font-size:12px;">' +
                '<strong style="color:var(--accent);">' + escapeHtml(msg.replies[i].userName) + ':</strong> ' +
                '<span style="color:var(--tx-dim);">' + msg.replies[i].content + '</span>' +
                '</div>';
        }
        repliesHtml += '</div>';
    }

    const canDelete = State.user && (
        State.user.id === msg.userId ||
        group.ownerId === State.user.id ||
        (group.admins || []).indexOf(State.user.id) > -1 ||
        (group.mods || []).indexOf(State.user.id) > -1
    );

    return '<div class="chat-msg" data-msg-id="' + msg.id + '">' +
        '<div class="user-avatar">' + (avatar ? '<img src="' + avatar + '">' : initial) + '</div>' +
        '<div class="chat-msg-content">' +
            '<div class="chat-msg-head">' +
                '<strong>' + escapeHtml(name) + '</strong>' + roleBadge +
                '<span class="time">' + timeAgo(msg.createdAt) + '</span>' +
            '</div>' +
            '<div class="chat-msg-body">' + (msg.content || '') + '</div>' +
            imageHtml +
            '<div class="chat-msg-actions">' +
                '<button class="chat-msg-btn ' + (userLiked ? 'liked' : '') + '" data-msg-like="' + msg.id + '" type="button">لایک ' + faNum((msg.likes || []).length) + '</button>' +
                '<button class="chat-msg-btn ' + (userDisliked ? 'disliked' : '') + '" data-msg-dislike="' + msg.id + '" type="button">دیس‌لایک ' + faNum((msg.dislikes || []).length) + '</button>' +
                '<button class="chat-msg-btn" data-msg-reply="' + msg.id + '" type="button">پاسخ</button>' +
                (canDelete ? '<button class="chat-msg-btn" data-msg-del="' + msg.id + '" type="button">حذف</button>' : '') +
            '</div>' +
            repliesHtml +
        '</div>' +
    '</div>';
}

function initChat(groupId) {
    const editor = $('#chatEditor');

    if (editor) {
        $$('.chat-toolbar button[data-cmd]').forEach(function (btn) {
            btn.addEventListener('click', function () {
                document.execCommand(btn.dataset.cmd, false, null);
                editor.focus();
            });
        });

        const cs = $('#chatSpoiler');
        if (cs) cs.addEventListener('click', function () {
            const sel = window.getSelection().toString() || 'متن مخفی';
            document.execCommand('insertHTML', false,
                '<span class="spoiler" onclick="this.classList.toggle(\'revealed\')">' + escapeHtml(sel) + '</span>');
            editor.focus();
        });

        const cc = $('#chatColor');
        if (cc) cc.addEventListener('click', function () {
            const p = $('#chatColorPicker');
            if (p) p.hidden = !p.hidden;
        });

        $$('#chatColorPicker .color-dot').forEach(function (d) {
            d.addEventListener('click', function () {
                document.execCommand('foreColor', false, d.dataset.color);
                editor.focus();
            });
        });

        const ci = $('#chatImage');
        if (ci) ci.addEventListener('click', function () {
            const inp = document.createElement('input');
            inp.type = 'file';
            inp.accept = 'image/*';
            inp.onchange = async function () {
                try {
                    const b64 = await fileToBase64(inp.files[0]);
                    sendChatMessage(groupId, null, b64);
                } catch (err) {
                    toast(err);
                }
            };
            inp.click();
        });

        const csend = $('#chatSend');
        if (csend) csend.addEventListener('click', function () {
            const content = editor.innerHTML.trim();
            if (!content || editor.textContent.trim().length < 1) return;
            sendChatMessage(groupId, content);
            editor.innerHTML = '';
        });

        editor.addEventListener('keydown', function (e) {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                const btn = $('#chatSend');
                if (btn) btn.click();
            }
        });
    }

    const chatBox = $('#chatMessages');
    if (chatBox) {
        chatBox.addEventListener('click', function (e) {
            const like = e.target.closest('[data-msg-like]');
            const dislike = e.target.closest('[data-msg-dislike]');
            const reply = e.target.closest('[data-msg-reply]');
            const del = e.target.closest('[data-msg-del]');

            if (like) toggleMsgReaction(groupId, like.dataset.msgLike, 'like');
            if (dislike) toggleMsgReaction(groupId, dislike.dataset.msgDislike, 'dislike');
            if (reply) replyToMessage(groupId, reply.dataset.msgReply);
            if (del && confirm('حذف بشه؟')) deleteMessage(groupId, del.dataset.msgDel);
        });
    }
}

function sendChatMessage(groupId, content, image) {
    if (!State.user) return;
    const groups = DB.getGroups();
    let g = null;
    for (let i = 0; i < groups.length; i++) {
        if (groups[i].id === groupId) { g = groups[i]; break; }
    }
    if (!g) return;

    g.messages = g.messages || [];
    g.messages.push({
        id: uid('m_'),
        userId: State.user.id,
        userName: State.user.displayName,
        userAvatar: State.user.avatar,
        content: content ? parseMentions(content) : '',
        image: image || null,
        createdAt: Date.now(),
        likes: [],
        dislikes: [],
        replies: []
    });

    DB.setGroups(groups);
    addActivity('chat', State.user.displayName + ' توی گروه «' + g.name + '» پیام داد');
    renderGroupPage(groupId);
}

function toggleMsgReaction(groupId, msgId, type) {
    if (!State.user) return;
    const groups = DB.getGroups();
    let g = null;
    for (let i = 0; i < groups.length; i++) {
        if (groups[i].id === groupId) { g = groups[i]; break; }
    }
    if (!g) return;

    let msg = null;
    for (let i = 0; i < (g.messages || []).length; i++) {
        if (g.messages[i].id === msgId) { msg = g.messages[i]; break; }
    }
    if (!msg) return;

    msg.likes = msg.likes || [];
    msg.dislikes = msg.dislikes || [];

    if (type === 'like') {
        msg.dislikes = msg.dislikes.filter(function (id) { return id !== State.user.id; });
        if (msg.likes.indexOf(State.user.id) > -1) {
            msg.likes = msg.likes.filter(function (id) { return id !== State.user.id; });
        } else {
            msg.likes.push(State.user.id);
        }
    } else {
        msg.likes = msg.likes.filter(function (id) { return id !== State.user.id; });
        if (msg.dislikes.indexOf(State.user.id) > -1) {
            msg.dislikes = msg.dislikes.filter(function (id) { return id !== State.user.id; });
        } else {
            msg.dislikes.push(State.user.id);
        }
    }

    DB.setGroups(groups);
    renderGroupPage(groupId);
}

function replyToMessage(groupId, msgId) {
    const text = prompt('پاسخ:');
    if (!text) return;
    if (!State.user) return;

    const groups = DB.getGroups();
    let g = null;
    for (let i = 0; i < groups.length; i++) {
        if (groups[i].id === groupId) { g = groups[i]; break; }
    }
    if (!g) return;

    let msg = null;
    for (let i = 0; i < (g.messages || []).length; i++) {
        if (g.messages[i].id === msgId) { msg = g.messages[i]; break; }
    }
    if (!msg) return;

    msg.replies = msg.replies || [];
    msg.replies.push({
        userId: State.user.id,
        userName: State.user.displayName,
        content: escapeHtml(text),
        createdAt: Date.now()
    });

    DB.setGroups(groups);
    renderGroupPage(groupId);
}

function deleteMessage(groupId, msgId) {
    const groups = DB.getGroups();
    let g = null;
    for (let i = 0; i < groups.length; i++) {
        if (groups[i].id === groupId) { g = groups[i]; break; }
    }
    if (!g) return;

    g.messages = (g.messages || []).filter(function (m) { return m.id !== msgId; });
    DB.setGroups(groups);
    renderGroupPage(groupId);
    toast('حذف شد');
}

function joinGroup(groupId) {
    if (!State.user) { toast('اول وارد شو'); return; }
    const groups = DB.getGroups();
    let g = null;
    for (let i = 0; i < groups.length; i++) {
        if (groups[i].id === groupId) { g = groups[i]; break; }
    }
    if (!g) return;

    if ((g.banned || []).indexOf(State.user.id) > -1) {
        toast('تو از این گروه بن شدی');
        return;
    }

    g.members = g.members || [];
    if (g.members.indexOf(State.user.id) === -1) g.members.push(State.user.id);

    const users = DB.getUsers();
    let me = null;
    for (let i = 0; i < users.length; i++) {
        if (users[i].id === State.user.id) { me = users[i]; break; }
    }
    if (me) {
        me.groups = me.groups || [];
        if (me.groups.indexOf(groupId) === -1) me.groups.push(groupId);
        DB.setUsers(users);
        State.user = me;
    }

    DB.setGroups(groups);
    toast('عضو شدی');
    renderGroupPage(groupId);
}

function requestJoinGroup(groupId) {
    if (!State.user) { toast('اول وارد شو'); return; }
    const groups = DB.getGroups();
    let g = null;
    for (let i = 0; i < groups.length; i++) {
        if (groups[i].id === groupId) { g = groups[i]; break; }
    }
    if (!g) return;

    g.joinRequests = g.joinRequests || [];
    if (g.joinRequests.indexOf(State.user.id) === -1) g.joinRequests.push(State.user.id);
    DB.setGroups(groups);

    const notifs = DB.getNotifs();
    notifs.push({
        id: uid('n_'),
        userId: g.ownerId,
        type: 'group_request',
        text: State.user.displayName + ' درخواست عضویت در گروه «' + g.name + '» داد',
        link: 'group:' + g.id,
        ts: Date.now(),
        read: false
    });
    DB.setNotifs(notifs);

    toast('درخواست فرستاده شد');
}

function openGroupSettings(groupId) {
    if (!State.user) return;
    const groups = DB.getGroups();
    let g = null;
    for (let i = 0; i < groups.length; i++) {
        if (groups[i].id === groupId) { g = groups[i]; break; }
    }
    if (!g) return;

    const isOwner = g.ownerId === State.user.id;
    const isAdmin = (g.admins || []).indexOf(State.user.id) > -1;
    const isMod = (g.mods || []).indexOf(State.user.id) > -1;

    if (!isOwner && !isAdmin && !isMod) {
        toast('دسترسی نداری');
        return;
    }

    const box = $('#groupSettingsBody');
    if (!box) return;

    const users = DB.getUsers();
    let membersHtml = '';
    for (let i = 0; i < (g.members || []).length; i++) {
        const mid = g.members[i];
        let u = null;
        for (let j = 0; j < users.length; j++) {
            if (users[j].id === mid) { u = users[j]; break; }
        }
        if (!u) continue;

        const isOwnerM = g.ownerId === mid;
        const isAdminM = (g.admins || []).indexOf(mid) > -1;
        const isModM = (g.mods || []).indexOf(mid) > -1;

        let roleLabel = '';
        if (isOwnerM) roleLabel = '<span class="role-badge owner">مدیر</span>';
        else if (isAdminM) roleLabel = '<span class="role-badge admin">ادمین</span>';
        else if (isModM) roleLabel = '<span class="role-badge mod">ناظر</span>';

        let btns = '';
        if (!isOwnerM && (isOwner || isAdmin)) {
            if (isOwner) btns += '<button class="btn-ghost small" data-promote-admin="' + mid + '" type="button">ادمین</button>';
            btns += '<button class="btn-ghost small" data-promote-mod="' + mid + '" type="button">ناظر</button>';
            btns += '<button class="btn-ghost small danger" data-ban-member="' + mid + '" type="button">بن</button>';
        }

        membersHtml += '<div style="display:flex;align-items:center;justify-content:space-between;padding:10px 0;border-bottom:1px solid var(--bd);gap:10px;">' +
            '<div style="display:flex;align-items:center;gap:10px;min-width:0;">' +
                '<div class="user-avatar" style="width:32px;height:32px;font-size:12px;">' +
                    (u.avatar ? '<img src="' + u.avatar + '">' : u.displayName[0]) +
                '</div>' +
                '<div style="min-width:0;">' +
                    '<strong style="font-size:13px;">' + escapeHtml(u.displayName) + '</strong> ' + roleLabel +
                    '<div style="font-size:11px;color:var(--tx-mute);direction:ltr;">@' + escapeHtml(u.username) + '</div>' +
                '</div>' +
            '</div>' +
            '<div style="display:flex;gap:4px;flex-wrap:wrap;">' + btns + '</div>' +
        '</div>';
    }

    let requestsHtml = '';
    if ((g.joinRequests || []).length) {
        requestsHtml = '<h4 style="font-size:14px;font-weight:800;margin:16px 0 10px;">درخواست‌ها</h4>';
        for (let i = 0; i < g.joinRequests.length; i++) {
            const mid = g.joinRequests[i];
            let u = null;
            for (let j = 0; j < users.length; j++) {
                if (users[j].id === mid) { u = users[j]; break; }
            }
            if (!u) continue;
            requestsHtml += '<div style="display:flex;justify-content:space-between;align-items:center;padding:8px 0;">' +
                '<strong>' + escapeHtml(u.displayName) + '</strong>' +
                '<div style="display:flex;gap:4px;">' +
                    '<button class="btn-primary small" data-accept-join="' + mid + '" type="button">قبول</button>' +
                    '<button class="btn-ghost small" data-reject-join="' + mid + '" type="button">رد</button>' +
                '</div>' +
            '</div>';
        }
    }

    box.innerHTML =
        '<div class="input-group"><label>اسم گروه</label><input type="text" id="gName" value="' + escapeHtml(g.name) + '"></div>' +
        '<div class="input-group"><label>توضیحات</label><textarea id="gDesc">' + escapeHtml(g.description || '') + '</textarea></div>' +
        '<button class="btn-primary full" id="gSave" type="button" style="margin-bottom:20px;">ذخیره تغییرات</button>' +
        '<h4 style="font-size:14px;font-weight:800;margin-bottom:10px;">اعضا (' + faNum((g.members || []).length) + ')</h4>' +
        '<div style="max-height:300px;overflow-y:auto;">' + membersHtml + '</div>' +
        requestsHtml;

    openModal('groupSettingsOverlay');

    const saveBtn = $('#gSave');
    if (saveBtn) saveBtn.addEventListener('click', function () {
        const newName = $('#gName').value.trim();
        if (!newName) return;

        const gs = DB.getGroups();
        for (let i = 0; i < gs.length; i++) {
            if (gs[i].id === groupId) {
                const oldName = gs[i].name;
                gs[i].name = newName;
                gs[i].description = $('#gDesc').value.trim();

                if (oldName !== newName) {
                    gs[i].messages = gs[i].messages || [];
                    gs[i].messages.push({
                        id: uid('m_'),
                        userId: 'system',
                        userName: 'سیستم',
                        content: 'اسم گروه از «' + escapeHtml(oldName) + '» به «' + escapeHtml(newName) + '» تغییر کرد',
                        createdAt: Date.now(),
                        likes: [], dislikes: [], replies: []
                    });
                }
                break;
            }
        }
        DB.setGroups(gs);
        toast('ذخیره شد');
        closeModal('groupSettingsOverlay');
        renderGroupPage(groupId);
    });

    box.addEventListener('click', function (e) {
        const pa = e.target.closest('[data-promote-admin]');
        const pm = e.target.closest('[data-promote-mod]');
        const ban = e.target.closest('[data-ban-member]');
        const acc = e.target.closest('[data-accept-join]');
        const rej = e.target.closest('[data-reject-join]');

        if (pa) {
            const gs = DB.getGroups();
            for (let i = 0; i < gs.length; i++) {
                if (gs[i].id === groupId) {
                    gs[i].admins = gs[i].admins || [];
                    if (gs[i].admins.indexOf(pa.dataset.promoteAdmin) === -1)
                        gs[i].admins.push(pa.dataset.promoteAdmin);
                    break;
                }
            }
            DB.setGroups(gs);
            toast('ادمین شد');
            openGroupSettings(groupId);
        }

        if (pm) {
            const gs = DB.getGroups();
            for (let i = 0; i < gs.length; i++) {
                if (gs[i].id === groupId) {
                    gs[i].mods = gs[i].mods || [];
                    if (gs[i].mods.indexOf(pm.dataset.promoteMod) === -1)
                        gs[i].mods.push(pm.dataset.promoteMod);
                    break;
                }
            }
            DB.setGroups(gs);
            toast('ناظر شد');
            openGroupSettings(groupId);
        }

        if (ban) {
            if (!confirm('بن بشه؟')) return;
            const gs = DB.getGroups();
            for (let i = 0; i < gs.length; i++) {
                if (gs[i].id === groupId) {
                    gs[i].banned = gs[i].banned || [];
                    if (gs[i].banned.indexOf(ban.dataset.banMember) === -1)
                        gs[i].banned.push(ban.dataset.banMember);
                    gs[i].members = (gs[i].members || []).filter(function (id) {
                        return id !== ban.dataset.banMember;
                    });

                    const users2 = DB.getUsers();
                    let banned = null;
                    for (let j = 0; j < users2.length; j++) {
                        if (users2[j].id === ban.dataset.banMember) { banned = users2[j]; break; }
                    }

                    gs[i].messages = gs[i].messages || [];
                    gs[i].messages.push({
                        id: uid('m_'),
                        userId: 'system',
                        userName: 'سیستم',
                        content: '«' + escapeHtml(banned ? banned.displayName : 'کاربر') + '» توسط «' + escapeHtml(State.user.displayName) + '» بن شد',
                        createdAt: Date.now(),
                        likes: [], dislikes: [], replies: []
                    });
                    break;
                }
            }
            DB.setGroups(gs);
            toast('بن شد');
            openGroupSettings(groupId);
        }

        if (acc) {
            const gs = DB.getGroups();
            for (let i = 0; i < gs.length; i++) {
                if (gs[i].id === groupId) {
                    gs[i].joinRequests = (gs[i].joinRequests || []).filter(function (id) {
                        return id !== acc.dataset.acceptJoin;
                    });
                    gs[i].members = gs[i].members || [];
                    if (gs[i].members.indexOf(acc.dataset.acceptJoin) === -1)
                        gs[i].members.push(acc.dataset.acceptJoin);
                    break;
                }
            }
            DB.setGroups(gs);
            toast('قبول شد');
            openGroupSettings(groupId);
        }

        if (rej) {
            const gs = DB.getGroups();
            for (let i = 0; i < gs.length; i++) {
                if (gs[i].id === groupId) {
                    gs[i].joinRequests = (gs[i].joinRequests || []).filter(function (id) {
                        return id !== rej.dataset.rejectJoin;
                    });
                    break;
                }
            }
            DB.setGroups(gs);
            toast('رد شد');
            openGroupSettings(groupId);
        }
    });
}

/* ═══════════════════════════════════
   Users Page
═══════════════════════════════════ */
function renderUsersPage() {
    const grid = $('#usersGrid');
    if (!grid) return;

    const users = DB.getUsers();

    grid.innerHTML = '';
    users.forEach(function (u) {
        const card = document.createElement('div');
        card.className = 'user-card';

        let actionBtn = '';
        if (State.user && State.user.id !== u.id) {
            actionBtn = '<button class="btn-primary small full" data-add-friend="' + u.id + '" type="button">افزودن دوست</button>';
        }

        card.innerHTML =
            '<div class="user-avatar">' + (u.avatar ? '<img src="' + u.avatar + '">' : u.displayName[0].toUpperCase()) + '</div>' +
            '<h3>' + escapeHtml(u.displayName) + '</h3>' +
            '<p>@' + escapeHtml(u.username) + '</p>' +
            actionBtn;

        grid.appendChild(card);
    });

    grid.addEventListener('click', function (e) {
        const btn = e.target.closest('[data-add-friend]');
        if (btn) sendFriendRequest(btn.dataset.addFriend);
    });
}

/* ═══════════════════════════════════
   Activity Page
═══════════════════════════════════ */
function renderActivityPage() {
    const list = $('#activityList');
    if (!list) return;

    const activities = DB.getActivity().slice(-50).reverse();

    if (!activities.length) {
        list.innerHTML = '<div class="empty-state"><h3>هنوز فعالیتی نیست</h3></div>';
        return;
    }

    list.innerHTML = '';
    activities.forEach(function (a) {
        const el = document.createElement('div');
        el.className = 'activity-item';

        const icons = {
            post: 'پ', comment: 'ن', chat: 'چ', like: 'ل', friend: 'د', group: 'گ'
        };

        el.innerHTML =
            '<div class="activity-icon">' + (icons[a.type] || '?') + '</div>' +
            '<div class="activity-body">' +
                '<p>' + escapeHtml(a.text) + '</p>' +
                '<small>' + timeAgo(a.ts) + '</small>' +
            '</div>';

        list.appendChild(el);
    });
}

function addActivity(type, text) {
    const activities = DB.getActivity();
    activities.push({ id: uid('a_'), type: type, text: text, ts: Date.now() });
    if (activities.length > 200) activities.splice(0, activities.length - 200);
    DB.setActivity(activities);
}

/* ═══════════════════════════════════
   Friend
═══════════════════════════════════ */
function sendFriendRequest(targetId) {
    if (!State.user) { toast('اول وارد شو'); return; }
    if (targetId === State.user.id) return;

    const users = DB.getUsers();
    let me = null, target = null;
    for (let i = 0; i < users.length; i++) {
        if (users[i].id === State.user.id) me = users[i];
        if (users[i].id === targetId) target = users[i];
    }
    if (!me || !target) return;

    if ((me.friends || []).indexOf(targetId) > -1) { toast('قبلا دوستته'); return; }
    if ((target.friendRequests || []).indexOf(me.id) > -1) { toast('قبلا درخواست دادی'); return; }

    target.friendRequests = target.friendRequests || [];
    target.friendRequests.push(me.id);
    DB.setUsers(users);
    State.user = me;

    const notifs = DB.getNotifs();
    notifs.push({
        id: uid('n_'),
        userId: targetId,
        type: 'friend_request',
        text: me.displayName + ' بهت درخواست دوستی داد',
        from: me.id,
        ts: Date.now(),
        read: false
    });
    DB.setNotifs(notifs);

    addActivity('friend', me.displayName + ' به ' + target.displayName + ' درخواست دوستی داد');
    toast('درخواست فرستاده شد');
}

/* ═══════════════════════════════════
   User Panel
═══════════════════════════════════ */
function openUserPanel() {
    if (!State.user) { openModal('authOverlay'); return; }
    const panel = $('#userPanel');
    if (!panel) return;

    renderUserPanelBody('activity');
    panel.classList.add('on');
    document.body.style.overflow = 'hidden';
}

function closeUserPanel() {
    const panel = $('#userPanel');
    if (panel) panel.classList.remove('on');
    document.body.style.overflow = '';
}

function renderUserPanelBody(tab) {
    const body = $('#userPanelBody');
    if (!body || !State.user) return;

    if (tab === 'activity')      body.innerHTML = renderActivityTab();
    else if (tab === 'profile')  body.innerHTML = renderProfileTab();
    else if (tab === 'notifications') body.innerHTML = renderNotifsTab();
    else if (tab === 'messages') body.innerHTML = renderMessagesTab();
    else if (tab === 'friends')  body.innerHTML = renderFriendsTab();
    else if (tab === 'groups')   body.innerHTML = renderGroupsTab();

    initUserPanelEvents(tab);
}

function renderActivityTab() {
    const u = State.user;
    const posts = DB.getPosts().filter(function (p) { return p.authorId === u.id; });
    let commentsCount = 0;
    DB.getPosts().forEach(function (p) {
        (p.comments || []).forEach(function (c) {
            if (c.userId === u.id) commentsCount++;
        });
    });

    let roleLabel = 'کاربر عادی';
    if (u.role === 'admin') roleLabel = 'مدیر سایت';
    else if (u.role === 'editor') roleLabel = 'سردبیر';
    else if (u.role === 'author') roleLabel = 'نویسنده';

    return '<div class="up-content active">' +
        '<div class="panel-stats-grid">' +
            '<div class="panel-stat-box"><strong>' + faNum(u.xp || 0) + '</strong><span>امتیاز</span></div>' +
            '<div class="panel-stat-box"><strong>' + faNum(u.level || 1) + '</strong><span>سطح</span></div>' +
            '<div class="panel-stat-box"><strong>' + faNum(posts.length) + '</strong><span>پست</span></div>' +
            '<div class="panel-stat-box"><strong>' + faNum(commentsCount) + '</strong><span>نظر</span></div>' +
            '<div class="panel-stat-box"><strong>' + faNum((u.friends || []).length) + '</strong><span>دوست</span></div>' +
            '<div class="panel-stat-box"><strong>' + faNum((u.groups || []).length) + '</strong><span>گروه</span></div>' +
        '</div>' +
        '<div style="padding:14px;border-radius:14px;background:var(--field);border:1px solid var(--bd);">' +
            '<div style="font-size:12px;color:var(--tx-mute);margin-bottom:6px;">وضعیت حساب</div>' +
            '<div style="font-size:14px;font-weight:700;">' + roleLabel + '</div>' +
        '</div>' +
        '<button class="btn-ghost full" id="logoutBtn" type="button" style="margin-top:16px;color:var(--bad);border-color:var(--bad);">خروج از حساب</button>' +
    '</div>';
}

function renderProfileTab() {
    const u = State.user;
    const initial = (u.displayName || 'U')[0].toUpperCase();

    return '<div class="up-content active">' +
        '<div class="profile-form">' +
            '<div class="profile-avatar-section">' +
                '<div class="user-avatar" id="profileAvatarEdit">' +
                    (u.avatar ? '<img src="' + u.avatar + '">' : initial) +
                '</div>' +
                '<button class="btn-ghost small" id="changeAvatarBtn" type="button">تغییر آواتار</button>' +
                '<input type="file" id="avatarFile" accept="image/*" hidden>' +
            '</div>' +

            '<div class="form-group"><label>لقب</label><input type="text" id="pTitle" value="' + escapeHtml(u.title || '') + '" placeholder="مثلا گیمر حرفه‌ای"></div>' +

            '<div class="form-row">' +
                '<div class="form-group"><label>نام</label><input type="text" id="pFirstName" value="' + escapeHtml(u.firstName || '') + '"></div>' +
                '<div class="form-group"><label>نام خانوادگی</label><input type="text" id="pLastName" value="' + escapeHtml(u.lastName || '') + '"></div>' +
            '</div>' +

            '<div class="form-group"><label>نام نمایشی</label><input type="text" id="pDisplayName" value="' + escapeHtml(u.displayName) + '"></div>' +
            '<div class="form-group"><label>تاریخ تولد</label><input type="text" id="pBirthday" value="' + escapeHtml(u.birthday || '') + '" placeholder="1380/01/15"></div>' +

            '<div class="form-group"><label>پلتفرم اصلی</label>' +
                '<select id="pPlatform">' +
                    '<option value="ps5"' + (u.platform === 'ps5' ? ' selected' : '') + '>PlayStation 5</option>' +
                    '<option value="xbox"' + (u.platform === 'xbox' ? ' selected' : '') + '>Xbox</option>' +
                    '<option value="switch"' + (u.platform === 'switch' ? ' selected' : '') + '>Nintendo Switch</option>' +
                    '<option value="pc"' + (u.platform === 'pc' ? ' selected' : '') + '>PC</option>' +
                    '<option value="mobile"' + (u.platform === 'mobile' ? ' selected' : '') + '>موبایل</option>' +
                '</select>' +
            '</div>' +

            '<div class="form-group"><label>وبسایت</label><input type="text" id="pWebsite" value="' + escapeHtml(u.website || '') + '" dir="ltr"></div>' +
            '<div class="form-group"><label>بیوگرافی</label><textarea id="pBio" placeholder="درباره خودت بنویس">' + escapeHtml(u.bio || '') + '</textarea></div>' +
            '<div class="form-group"><label>بازی‌های مورد علاقه</label><input type="text" id="pFavGames" value="' + escapeHtml(u.favGames || '') + '" placeholder="Elden Ring، Witcher 3"></div>' +
            '<div class="form-group"><label>فیلم‌های مورد علاقه</label><input type="text" id="pFavMovies" value="' + escapeHtml(u.favMovies || '') + '" placeholder="Interstellar"></div>' +
            '<div class="form-group"><label>اینستاگرام</label><input type="text" id="pInstagram" value="' + escapeHtml(u.instagram || '') + '" dir="ltr"></div>' +
            '<div class="form-group"><label>تلگرام</label><input type="text" id="pTelegram" value="' + escapeHtml(u.telegram || '') + '" dir="ltr"></div>' +
            '<div class="form-group"><label>دیسکورد</label><input type="text" id="pDiscord" value="' + escapeHtml(u.discord || '') + '" dir="ltr"></div>' +

            '<button class="btn-primary full" id="saveProfileBtn" type="button">ذخیره پروفایل</button>' +
        '</div>' +
    '</div>';
}

function renderNotifsTab() {
    const notifs = DB.getNotifs().filter(function (n) {
        return n.userId === State.user.id;
    }).reverse();
    const unread = notifs.filter(function (n) { return !n.read; });

    if (!notifs.length) {
        return '<div class="empty-state"><h3>اعلانی نداری</h3></div>';
    }

    let html = '<div class="up-content active">';
    if (unread.length) {
        html += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">' +
            '<span style="font-size:12px;font-weight:700;color:var(--tx-mute);">' + faNum(unread.length) + ' خوانده‌نشده</span>' +
            '<button class="btn-ghost small" id="markAllRead" type="button">خواندن همه</button>' +
        '</div>';
    }

    notifs.forEach(function (n) {
        const icons = { comment: 'ن', friend_request: 'د', message: 'پ', group_request: 'گ' };
        html += '<div class="notif-item ' + (n.read ? '' : 'unread') + '" data-notif-id="' + n.id + '" ' +
            (n.link ? 'data-notif-link="' + n.link + '"' : '') + '>' +
            '<div class="notif-icon">' + (icons[n.type] || '؟') + '</div>' +
            '<div class="notif-body">' +
                '<p>' + escapeHtml(n.text) + '</p>' +
                '<small>' + timeAgo(n.ts) + '</small>' +
            '</div>' +
        '</div>';
    });
    html += '</div>';
    return html;
}

function renderMessagesTab() {
    const msgs = DB.getMessages().filter(function (m) {
        return m.to === State.user.id || m.from === State.user.id;
    }).reverse();

    if (!msgs.length) {
        return '<div class="empty-state"><h3>پیامی نداری</h3></div>';
    }

    let html = '<div class="up-content active">';
    msgs.forEach(function (m) {
        const isMine = m.from === State.user.id;
        const otherId = isMine ? m.to : m.from;
        const users = DB.getUsers();
        let other = null;
        for (let i = 0; i < users.length; i++) {
            if (users[i].id === otherId) { other = users[i]; break; }
        }
        html += '<div class="notif-item">' +
            '<div class="user-avatar" style="width:36px;height:36px;">' +
                (other && other.avatar ? '<img src="' + other.avatar + '">' : (other ? other.displayName[0] : 'U')) +
            '</div>' +
            '<div class="notif-body">' +
                '<p><strong>' + (isMine ? 'شما' : escapeHtml(other ? other.displayName : 'کاربر')) + ':</strong> ' + escapeHtml(m.text) + '</p>' +
                '<small>' + timeAgo(m.ts) + '</small>' +
            '</div>' +
        '</div>';
    });
    html += '</div>';
    return html;
}

function renderFriendsTab() {
    const u = State.user;
    const friends = u.friends || [];
    const requests = u.friendRequests || [];

    let html = '<div class="up-content active">';

    if (requests.length) {
        html += '<h4 style="font-size:14px;font-weight:800;margin-bottom:10px;">درخواست‌ها (' + faNum(requests.length) + ')</h4>';
        const users = DB.getUsers();
        requests.forEach(function (rid) {
            let r = null;
            for (let i = 0; i < users.length; i++) {
                if (users[i].id === rid) { r = users[i]; break; }
            }
            if (!r) return;
            html += '<div class="notif-item">' +
                '<div class="user-avatar" style="width:36px;height:36px;">' +
                    (r.avatar ? '<img src="' + r.avatar + '">' : r.displayName[0]) +
                '</div>' +
                '<div class="notif-body">' +
                    '<p><strong>' + escapeHtml(r.displayName) + '</strong> @' + escapeHtml(r.username) + '</p>' +
                    '<div style="display:flex;gap:6px;margin-top:6px;">' +
                        '<button class="btn-primary small" data-accept-friend="' + rid + '" type="button">قبول</button>' +
                        '<button class="btn-ghost small" data-reject-friend="' + rid + '" type="button">رد</button>' +
                    '</div>' +
                '</div>' +
            '</div>';
        });
    }

    html += '<h4 style="font-size:14px;font-weight:800;margin:16px 0 10px;">دوستان (' + faNum(friends.length) + ')</h4>';

    if (!friends.length) {
        html += '<p style="text-align:center;color:var(--tx-mute);padding:20px;font-size:13px;">هنوز دوستی نداری</p>';
    } else {
        const users = DB.getUsers();
        friends.forEach(function (fid) {
            let f = null;
            for (let i = 0; i < users.length; i++) {
                if (users[i].id === fid) { f = users[i]; break; }
            }
            if (!f) return;
            html += '<div class="notif-item">' +
                '<div class="user-avatar" style="width:36px;height:36px;">' +
                    (f.avatar ? '<img src="' + f.avatar + '">' : f.displayName[0]) +
                '</div>' +
                '<div class="notif-body">' +
                    '<p><strong>' + escapeHtml(f.displayName) + '</strong></p>' +
                    '<small>@' + escapeHtml(f.username) + '</small>' +
                '</div>' +
                '<button class="btn-ghost small" data-chat-friend="' + fid + '" type="button">پیام</button>' +
            '</div>';
        });
    }

    html += '</div>';
    return html;
}

function renderGroupsTab() {
    const u = State.user;
    const groups = DB.getGroups().filter(function (g) {
        return (u.groups || []).indexOf(g.id) > -1;
    });

    if (!groups.length) {
        return '<div class="empty-state"><h3>توی هیچ گروهی نیستی</h3></div>';
    }

    let html = '<div class="up-content active">';
    groups.forEach(function (g) {
        html += '<div class="notif-item" data-group-link="' + g.id + '" style="cursor:pointer;">' +
            '<div class="user-avatar" style="width:36px;height:36px;font-size:14px;">' +
                (g.avatar ? '<img src="' + g.avatar + '">' : g.name[0]) +
            '</div>' +
            '<div class="notif-body">' +
                '<p><strong>' + escapeHtml(g.name) + '</strong></p>' +
                '<small>' + faNum((g.members || []).length) + ' عضو</small>' +
            '</div>' +
        '</div>';
    });
    html += '</div>';
    return html;
}

function initUserPanelEvents(tab) {
    if (tab === 'activity') {
        const btn = $('#logoutBtn');
        if (btn) btn.addEventListener('click', logoutUser);
    }

    if (tab === 'profile') {
        const changeBtn = $('#changeAvatarBtn');
        const fileInput = $('#avatarFile');
        if (changeBtn && fileInput) {
            changeBtn.addEventListener('click', function () { fileInput.click(); });
            fileInput.addEventListener('change', async function (e) {
                try {
                    const b64 = await fileToBase64(e.target.files[0]);
                    const users = DB.getUsers();
                    for (let i = 0; i < users.length; i++) {
                        if (users[i].id === State.user.id) { users[i].avatar = b64; break; }
                    }
                    DB.setUsers(users);
                    State.user = getCurrentUser();
                    updateAuthUI();
                    renderUserPanelBody('profile');
                    toast('آواتار تغییر کرد');
                } catch (err) { toast(err); }
            });
        }

        const saveBtn = $('#saveProfileBtn');
        if (saveBtn) saveBtn.addEventListener('click', function () {
            const users = DB.getUsers();
            for (let i = 0; i < users.length; i++) {
                if (users[i].id === State.user.id) {
                    users[i].title = $('#pTitle').value.trim();
                    users[i].firstName = $('#pFirstName').value.trim();
                    users[i].lastName = $('#pLastName').value.trim();
                    users[i].displayName = $('#pDisplayName').value.trim() || users[i].displayName;
                    users[i].birthday = $('#pBirthday').value.trim();
                    users[i].platform = $('#pPlatform').value;
                    users[i].website = $('#pWebsite').value.trim();
                    users[i].bio = $('#pBio').value.trim();
                    users[i].favGames = $('#pFavGames').value.trim();
                    users[i].favMovies = $('#pFavMovies').value.trim();
                    users[i].instagram = $('#pInstagram').value.trim();
                    users[i].telegram = $('#pTelegram').value.trim();
                    users[i].discord = $('#pDiscord').value.trim();
                    break;
                }
            }
            DB.setUsers(users);
            State.user = getCurrentUser();
            updateAuthUI();
            toast('ذخیره شد');
        });
    }

    if (tab === 'notifications') {
        const mark = $('#markAllRead');
        if (mark) mark.addEventListener('click', function () {
            const notifs = DB.getNotifs();
            notifs.forEach(function (n) {
                if (n.userId === State.user.id) n.read = true;
            });
            DB.setNotifs(notifs);
            updateBadges();
            renderUserPanelBody('notifications');
        });

        $$('[data-notif-id]').forEach(function (el) {
            el.addEventListener('click', function () {
                const nid = el.dataset.notifId;
                const notifs = DB.getNotifs();
                for (let i = 0; i < notifs.length; i++) {
                    if (notifs[i].id === nid) { notifs[i].read = true; break; }
                }
                DB.setNotifs(notifs);
                updateBadges();

                const link = el.dataset.notifLink;
                if (link) {
                    const parts = link.split(':');
                    if (parts[0] === 'post') { closeUserPanel(); showPage('post', parts[1]); }
                    else if (parts[0] === 'group') { closeUserPanel(); showPage('group', parts[1]); }
                } else {
                    renderUserPanelBody('notifications');
                }
            });
        });
    }

    if (tab === 'friends') {
        $$('[data-accept-friend]').forEach(function (b) {
            b.addEventListener('click', function () { acceptFriend(b.dataset.acceptFriend); });
        });
        $$('[data-reject-friend]').forEach(function (b) {
            b.addEventListener('click', function () { rejectFriend(b.dataset.rejectFriend); });
        });
        $$('[data-chat-friend]').forEach(function (b) {
            b.addEventListener('click', function () {
                const text = prompt('پیام:');
                if (text) sendDirectMessage(b.dataset.chatFriend, text);
            });
        });
    }

    if (tab === 'groups') {
        $$('[data-group-link]').forEach(function (el) {
            el.addEventListener('click', function () {
                closeUserPanel();
                showPage('group', el.dataset.groupLink);
            });
        });
    }
}

function acceptFriend(fromId) {
    const users = DB.getUsers();
    let me = null, other = null;
    for (let i = 0; i < users.length; i++) {
        if (users[i].id === State.user.id) me = users[i];
        if (users[i].id === fromId) other = users[i];
    }
    if (!me || !other) return;

    me.friendRequests = (me.friendRequests || []).filter(function (id) { return id !== fromId; });
    me.friends = me.friends || [];
    other.friends = other.friends || [];
    if (me.friends.indexOf(fromId) === -1) me.friends.push(fromId);
    if (other.friends.indexOf(me.id) === -1) other.friends.push(me.id);

    DB.setUsers(users);
    State.user = me;
    updateBadges();
    renderUserPanelBody('friends');
    toast('حالا دوستید');
}

function rejectFriend(fromId) {
    const users = DB.getUsers();
    let me = null;
    for (let i = 0; i < users.length; i++) {
        if (users[i].id === State.user.id) { me = users[i]; break; }
    }
    if (!me) return;

    me.friendRequests = (me.friendRequests || []).filter(function (id) { return id !== fromId; });
    DB.setUsers(users);
    State.user = me;
    updateBadges();
    renderUserPanelBody('friends');
}

function sendDirectMessage(toId, text) {
    if (!State.user) return;
    const messages = DB.getMessages();
    messages.push({
        id: uid('m_'),
        from: State.user.id,
        to: toId,
        text: text,
        ts: Date.now(),
        read: false
    });
    DB.setMessages(messages);

    const notifs = DB.getNotifs();
    notifs.push({
        id: uid('n_'),
        userId: toId,
        type: 'message',
        text: State.user.displayName + ' بهت پیام داد',
        ts: Date.now(),
        read: false
    });
    DB.setNotifs(notifs);

    toast('پیام فرستاده شد');
}

/* ═══════════════════════════════════
   Modal
═══════════════════════════════════ */
function openModal(id) {
    const el = document.getElementById(id);
    if (!el) return;
    el.hidden = false;
    requestAnimationFrame(function () { el.classList.add('on'); });
    document.body.style.overflow = 'hidden';
}

function closeModal(id) {
    const el = document.getElementById(id);
    if (!el) return;
    el.classList.remove('on');
    setTimeout(function () {
        el.hidden = true;
        if (!document.querySelector('.modal-overlay.on') && !document.querySelector('.user-panel.on')) {
            document.body.style.overflow = '';
        }
    }, 220);
}

/* ═══════════════════════════════════
   Auth Form
═══════════════════════════════════ */
function initAuth() {
    const tabs = $$('.auth-tab');
    const forms = $$('.auth-form');

    tabs.forEach(function (tab) {
        tab.addEventListener('click', function () {
            const target = tab.dataset.authTab;
            tabs.forEach(function (t) { t.classList.toggle('active', t === tab); });
            forms.forEach(function (f) {
                const active = f.dataset.authForm === target;
                f.classList.toggle('active', active);
                f.hidden = !active;
            });
        });
    });

    $$('[data-switch-auth]').forEach(function (btn) {
        btn.addEventListener('click', function () {
            const t = tabs.find(function (x) { return x.dataset.authTab === btn.dataset.switchAuth; });
            if (t) t.click();
        });
    });

    const loginForm = $('#loginForm');
    if (loginForm) loginForm.addEventListener('submit', function (e) {
        e.preventDefault();
        const fd = new FormData(e.target);
        const r = loginUser(fd.get('username'), fd.get('password'));
        if (r.ok) {
            toast('خوش اومدی ' + r.user.displayName);
            closeModal('authOverlay');
            e.target.reset();
        } else {
            toast(r.error);
        }
    });

    const regForm = $('#registerForm');
    if (regForm) regForm.addEventListener('submit', function (e) {
        e.preventDefault();
        const fd = new FormData(e.target);
        const r = registerUser({
            username: fd.get('username'),
            displayName: fd.get('displayName'),
            password: fd.get('password'),
            platform: fd.get('platform') || 'pc'
        });
        if (r.ok) {
            toast('خوش اومدی ' + r.user.displayName);
            closeModal('authOverlay');
            e.target.reset();
            setTimeout(function () {
                if (r.user.role === 'admin') toast('تو اولین کاربری، مدیر شدی');
            }, 700);
        } else {
            toast(r.error);
        }
    });

    const guest = $('#userBtnGuest');
    if (guest) guest.addEventListener('click', function () { openModal('authOverlay'); });

    const drawerLogin = $('#drawerLoginBtn');
    if (drawerLogin) drawerLogin.addEventListener('click', function () {
        closeDrawer();
        openModal('authOverlay');
    });

    const userBtn = $('#userBtn');
    if (userBtn) userBtn.addEventListener('click', openUserPanel);
}

/* ═══════════════════════════════════
   Drawer
═══════════════════════════════════ */
function openDrawer() {
    const d = $('#drawer');
    if (!d) return;
    d.hidden = false;
    document.body.style.overflow = 'hidden';
}

function closeDrawer() {
    const d = $('#drawer');
    if (!d) return;
    d.hidden = true;
    document.body.style.overflow = '';
}

function initDrawer() {
    const menuBtn = $('#menuBtn');
    const closeBtn = $('#drawerClose');
    const backdrop = $('#drawerBackdrop');

    if (menuBtn) menuBtn.addEventListener('click', openDrawer);
    if (closeBtn) closeBtn.addEventListener('click', closeDrawer);
    if (backdrop) backdrop.addEventListener('click', closeDrawer);

    const forumBtn = $('#drawerForumBtn');
    const forumSub = $('#drawerForumSub');
    if (forumBtn && forumSub) {
        forumBtn.addEventListener('click', function () {
            forumSub.classList.toggle('open');
            forumBtn.classList.toggle('open');
        });
    }

    const moreBtn = $('#drawerMoreBtn');
    const moreSub = $('#drawerMoreSub');
    if (moreBtn && moreSub) {
        moreBtn.addEventListener('click', function () {
            moreSub.classList.toggle('open');
            moreBtn.classList.toggle('open');
        });
    }

    /* ناوبری */
    $$('[data-nav]').forEach(function (el) {
        el.addEventListener('click', function (e) {
            e.preventDefault();
            const page = el.dataset.nav;
            closeDrawer();
            closeUserPanel();
            if (page === 'explore') {
                showPage('home');
                setTimeout(function () {
                    const el2 = document.getElementById('postsGrid');
                    if (el2) el2.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }, 100);
            } else {
                showPage(page);
            }
        });
    });
}

/* ═══════════════════════════════════
   Group Creation
═══════════════════════════════════ */
function initGroupCreation() {
    const btn = $('#createGroupBtn');
    if (btn) btn.addEventListener('click', function () {
        if (!State.user || State.user.role !== 'admin') { toast('فقط مدیر'); return; }
        openModal('groupModalOverlay');
    });

    const form = $('#groupForm');
    if (form) form.addEventListener('submit', function (e) {
        e.preventDefault();
        const fd = new FormData(e.target);
        const name = fd.get('name').trim();
        const description = fd.get('description').trim();
        const type = fd.get('type') || 'public';

        if (!name) return;

        const groups = DB.getGroups();
        const g = {
            id: uid('g_'),
            name: name,
            description: description,
            type: type,
            ownerId: State.user.id,
            members: [State.user.id],
            admins: [],
            mods: [],
            banned: [],
            joinRequests: [],
            messages: [],
            avatar: null,
            cover: null,
            createdAt: Date.now()
        };

        groups.push(g);
        DB.setGroups(groups);

        const users = DB.getUsers();
        for (let i = 0; i < users.length; i++) {
            if (users[i].id === State.user.id) {
                users[i].groups = users[i].groups || [];
                users[i].groups.push(g.id);
                break;
            }
        }
        DB.setUsers(users);
        State.user = getCurrentUser();

        addActivity('group', State.user.displayName + ' گروه «' + name + '» رو ساخت');
        toast('گروه ساخته شد');
        closeModal('groupModalOverlay');
        e.target.reset();
        showPage('group', g.id);
    });
}

/* ═══════════════════════════════════
   Filters
═══════════════════════════════════ */
function initFilters() {
    $$('#postFilters .filter-chip').forEach(function (chip) {
        chip.addEventListener('click', function () {
            $$('#postFilters .filter-chip').forEach(function (c) { c.classList.remove('active'); });
            chip.classList.add('active');
            State.postFilter = chip.dataset.filter;
            renderPosts();
        });
    });

    $$('#timeFilter .time-chip').forEach(function (chip) {
        chip.addEventListener('click', function () {
            $$('#timeFilter .time-chip').forEach(function (c) { c.classList.remove('active'); });
            chip.classList.add('active');
            State.timeFilter = chip.dataset.time;
            renderTrending();
        });
    });

    $$('.group-tab').forEach(function (tab) {
        tab.addEventListener('click', function () {
            $$('.group-tab').forEach(function (t) { t.classList.remove('active'); });
            tab.classList.add('active');
            State.groupFilter = tab.dataset.groupsTab;
            renderGroupsPage();
        });
    });

    $$('.up-tab').forEach(function (tab) {
        tab.addEventListener('click', function () {
            $$('.up-tab').forEach(function (t) { t.classList.remove('active'); });
            tab.classList.add('active');
            renderUserPanelBody(tab.dataset.upTab);
        });
    });
}

/* ═══════════════════════════════════
   Search
═══════════════════════════════════ */
function initSearch() {
    const input = $('#searchInput');
    const results = $('#searchResults');

    const searchBtn = $('#searchBtn');
    if (searchBtn) searchBtn.addEventListener('click', function () {
        openModal('searchOverlay');
        setTimeout(function () { if (input) input.focus(); }, 250);
    });

    if (!input || !results) return;

    input.addEventListener('input', function (e) {
        const q = e.target.value.trim().toLowerCase();
        if (q.length < 2) {
            results.innerHTML = '<p class="search-hint">شروع به تایپ کن تا نتایج رو ببینی</p>';
            return;
        }

        const posts = DB.getPosts().filter(function (p) {
            return p.status === 'published' &&
                ((p.title || '').toLowerCase().indexOf(q) > -1 ||
                 stripHtml(p.content).toLowerCase().indexOf(q) > -1);
        }).slice(0, 5);

        const users = DB.getUsers().filter(function (u) {
            return u.username.indexOf(q) > -1 || (u.displayName || '').toLowerCase().indexOf(q) > -1;
        }).slice(0, 5);

        const groups = DB.getGroups().filter(function (g) {
            return g.type === 'public' && (g.name || '').toLowerCase().indexOf(q) > -1;
        }).slice(0, 3);

        let html = '';

        if (posts.length) {
            html += '<div class="search-result-section">پست‌ها</div>';
            posts.forEach(function (p) {
                html += '<div class="search-result-item" data-open-post="' + p.id + '">' +
                    '<div class="search-result-icon">پ</div>' +
                    '<div class="search-result-info">' +
                        '<strong>' + escapeHtml(p.title) + '</strong>' +
                        '<small>' + faNum(p.views || 0) + ' بازدید</small>' +
                    '</div>' +
                '</div>';
            });
        }

        if (users.length) {
            html += '<div class="search-result-section">کاربران</div>';
            users.forEach(function (u) {
                html += '<div class="search-result-item">' +
                    '<div class="search-result-icon">' +
                        (u.avatar ? '<img src="' + u.avatar + '">' : u.displayName[0]) +
                    '</div>' +
                    '<div class="search-result-info">' +
                        '<strong>' + escapeHtml(u.displayName) + '</strong>' +
                        '<small>@' + escapeHtml(u.username) + '</small>' +
                    '</div>' +
                '</div>';
            });
        }

        if (groups.length) {
            html += '<div class="search-result-section">گروه‌ها</div>';
            groups.forEach(function (g) {
                html += '<div class="search-result-item" data-open-group="' + g.id + '">' +
                    '<div class="search-result-icon">' +
                        (g.avatar ? '<img src="' + g.avatar + '">' : g.name[0]) +
                    '</div>' +
                    '<div class="search-result-info">' +
                        '<strong>' + escapeHtml(g.name) + '</strong>' +
                        '<small>' + faNum((g.members || []).length) + ' عضو</small>' +
                    '</div>' +
                '</div>';
            });
        }

        if (!html) html = '<p class="search-hint">نتیجه‌ای پیدا نشد</p>';
        results.innerHTML = html;

        $$('[data-open-post]', results).forEach(function (el) {
            el.addEventListener('click', function () {
                closeModal('searchOverlay');
                showPage('post', el.dataset.openPost);
            });
        });
        $$('[data-open-group]', results).forEach(function (el) {
            el.addEventListener('click', function () {
                closeModal('searchOverlay');
                showPage('group', el.dataset.openGroup);
            });
        });
    });
}

/* ═══════════════════════════════════
   Editor
═══════════════════════════════════ */
let editingPostId = null;

function openEditor(postId) {
    const u = State.user;
    if (!u) { openModal('authOverlay'); return; }
    if (u.role !== 'admin' && u.role !== 'editor' && u.role !== 'author') {
        toast('اجازه نداری');
        return;
    }

    editingPostId = postId || null;
    const modal = $('#editorFullscreen');
    const titleEl = $('#editorTitle');
    const contentEl = $('#editorContent');
    const titleText = $('#editorTitleText');

    if (postId) {
        const posts = DB.getPosts();
        let post = null;
        for (let i = 0; i < posts.length; i++) {
            if (posts[i].id === postId) { post = posts[i]; break; }
        }
        if (post) {
            titleEl.value = post.title;
            contentEl.innerHTML = post.content;
            $('#editorCategory').value = post.category;
            $('#editorPlatform').value = post.platform || 'all';
            $('#editorTags').value = (post.tags || []).join('، ');
            $('#editorCover').value = post.cover || '';
            $('#editorExcerpt').value = post.excerpt || '';
            $('#editorScore').value = post.score || '';
            $('#editorEditorChoice').value = post.editorChoice ? 'true' : 'false';
            if (titleText) titleText.textContent = 'ویرایش پست';
        }
    } else {
        titleEl.value = '';
        contentEl.innerHTML = '';
        $('#editorCategory').value = 'news';
        $('#editorPlatform').value = 'all';
        $('#editorTags').value = '';
        $('#editorCover').value = '';
        $('#editorExcerpt').value = '';
        $('#editorScore').value = '';
        $('#editorEditorChoice').value = 'false';
        if (titleText) titleText.textContent = 'پست جدید';
    }

    modal.hidden = false;
    document.body.style.overflow = 'hidden';
}

function closeEditor() {
    const modal = $('#editorFullscreen');
    if (modal) modal.hidden = true;
    document.body.style.overflow = '';
}

function savePost(isDraft) {
    const title = $('#editorTitle').value.trim();
    const content = $('#editorContent').innerHTML;
    if (!title || !content) {
        toast('عنوان و محتوا لازمه');
        return;
    }

    const u = State.user;
    const posts = DB.getPosts();

    const data = {
        id: editingPostId || uid('p_'),
        title: title,
        content: content,
        category: $('#editorCategory').value,
        platform: $('#editorPlatform').value,
        tags: $('#editorTags').value.split('،').map(function (t) { return t.trim(); }).filter(Boolean),
        cover: $('#editorCover').value.trim() || null,
        excerpt: $('#editorExcerpt').value.trim(),
        score: $('#editorScore').value ? +$('#editorScore').value : null,
        editorChoice: $('#editorEditorChoice').value === 'true',
        status: isDraft ? 'draft' : 'published',
        authorId: u.id,
        authorName: u.displayName,
        authorAvatar: u.avatar,
        createdAt: editingPostId ? (posts.find(function (p) { return p.id === editingPostId; }) || {}).createdAt || Date.now() : Date.now(),
        updatedAt: Date.now(),
        views: editingPostId ? (posts.find(function (p) { return p.id === editingPostId; }) || {}).views || 0 : 0,
        comments: editingPostId ? (posts.find(function (p) { return p.id === editingPostId; }) || {}).comments || [] : []
    };

    let found = false;
    for (let i = 0; i < posts.length; i++) {
        if (posts[i].id === data.id) { posts[i] = data; found = true; break; }
    }
    if (!found) posts.unshift(data);

    DB.setPosts(posts);

    if (!editingPostId) {
        addActivity('post', u.displayName + ' پست «' + title + '» رو ' + (isDraft ? 'ذخیره' : 'منتشر') + ' کرد');

        const users = DB.getUsers();
        for (let i = 0; i < users.length; i++) {
            if (users[i].id === u.id) {
                users[i].xp = (users[i].xp || 0) + 15;
                users[i].level = Math.floor(users[i].xp / 100) + 1;
                break;
            }
        }
        DB.setUsers(users);
        State.user = getCurrentUser();
    }

    toast(isDraft ? 'پیش‌نویس ذخیره شد' : (editingPostId ? 'ویرایش شد' : 'منتشر شد'));
    closeEditor();
    renderHome();
    editingPostId = null;
}

function initEditor() {
    $$('.editor-toolbar button[data-cmd]').forEach(function (btn) {
        btn.addEventListener('click', function (e) {
            e.preventDefault();
            document.execCommand(btn.dataset.cmd, false, btn.dataset.val || null);
            const ec = $('#editorContent');
            if (ec) ec.focus();
        });
    });

    const tImg = $('#toolbarImage');
    if (tImg) tImg.addEventListener('click', function () {
        const url = prompt('آدرس تصویر:');
        if (url) document.execCommand('insertImage', false, url);
    });

    const tLink = $('#toolbarLink');
    if (tLink) tLink.addEventListener('click', function () {
        const url = prompt('آدرس لینک:');
        if (url) document.execCommand('createLink', false, url);
    });

    const tCode = $('#toolbarCode');
    if (tCode) tCode.addEventListener('click', function () {
        const t = prompt('کد:');
        if (t) document.execCommand('insertHTML', false, '<code>' + escapeHtml(t) + '</code>');
    });

    const tSpoiler = $('#toolbarSpoiler');
    if (tSpoiler) tSpoiler.addEventListener('click', function () {
        const sel = window.getSelection().toString() || 'متن مخفی';
        document.execCommand('insertHTML', false,
            '<span class="spoiler" onclick="this.classList.toggle(\'revealed\')">' + escapeHtml(sel) + '</span>');
    });

    const saveDraft = $('#editorSaveDraftBtn');
    if (saveDraft) saveDraft.addEventListener('click', function () { savePost(true); });

    const publish = $('#editorPublishBtn');
    if (publish) publish.addEventListener('click', function () { savePost(false); });

    const closeBtn = $('#editorCloseBtn');
    if (closeBtn) closeBtn.addEventListener('click', closeEditor);

    const uploadCover = $('#editorUploadCover');
    if (uploadCover) uploadCover.addEventListener('click', function () {
        const inp = document.createElement('input');
        inp.type = 'file';
        inp.accept = 'image/*';
        inp.onchange = async function () {
            try {
                const b64 = await fileToBase64(inp.files[0]);
                $('#editorCover').value = b64;
                toast('آپلود شد');
            } catch (err) { toast(err); }
        };
        inp.click();
    });
}

/* ═══════════════════════════════════
   Scroll UI
═══════════════════════════════════ */
function initScrollUI() {
    const bar = $('#scrollProgress');
    const nav = $('#navShell');
    const toTop = $('#toTop');

    let raf = null;
    window.addEventListener('scroll', function () {
        if (raf) return;
        raf = requestAnimationFrame(function () {
            const y = window.scrollY;
            const total = document.documentElement.scrollHeight - window.innerHeight;
            if (bar) bar.style.width = (total > 0 ? (y / total) * 100 : 0) + '%';
            if (nav) nav.classList.toggle('scrolled', y > 40);
            if (toTop) toTop.classList.toggle('show', y > 500);
            raf = null;
        });
    }, { passive: true });

    if (toTop) toTop.addEventListener('click', function () {
        window.scrollTo({ top: 0, behavior: 'smooth' });
    });
}

/* ═══════════════════════════════════
   Close Handlers
═══════════════════════════════════ */
function initCloseHandlers() {
    document.addEventListener('click', function (e) {
        const closeBtn = e.target.closest('[data-close]');
        if (closeBtn) {
            const target = closeBtn.dataset.close;
            if (target === 'auth') closeModal('authOverlay');
            else if (target === 'search') closeModal('searchOverlay');
            else if (target === 'group') closeModal('groupModalOverlay');
            else if (target === 'groupSettings') closeModal('groupSettingsOverlay');
        }
    });

    document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape') {
            closeModal('authOverlay');
            closeModal('searchOverlay');
            closeModal('groupModalOverlay');
            closeModal('groupSettingsOverlay');
            closeDrawer();
            closeUserPanel();
        }
        if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
            e.preventDefault();
            openModal('searchOverlay');
        }
    });

    const userPanelClose = $('#userPanelClose');
    if (userPanelClose) userPanelClose.addEventListener('click', closeUserPanel);
}

/* ═══════════════════════════════════
   Boot
═══════════════════════════════════ */
function boot() {
    console.log('نووا گیم');

    applyTheme(State.theme);
    document.documentElement.dataset.perf = State.perf === 'auto' ? detectPerf() : State.perf;

    State.user = getCurrentUser();
    updateAuthUI();

    initScrollUI();
    initAuth();
    initDrawer();
    initEditor();
    initSearch();
    initGroupCreation();
    initFilters();
    initCloseHandlers();

    const themeBtn = $('#themeBtn');
    if (themeBtn) themeBtn.addEventListener('click', flipTheme);

    const createBtn = $('#createPostBtn');
    if (createBtn) createBtn.addEventListener('click', function () { openEditor(); });

    renderHome();

    console.log('میانبر: Ctrl+K برای جستجو');
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
} else {
    boot();
      }
