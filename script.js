const ACCOUNTS_STORAGE_KEY = 'busTrackingAccounts';
const CURRENT_USER_KEY = 'busTrackingCurrentUser';
const LOGIN_SESSION_TIMEOUT_MS = 8 * 60 * 60 * 1000;
let accountsCache = [];

async function loadAccounts() {
    try {
        const accounts = JSON.parse(localStorage.getItem(ACCOUNTS_STORAGE_KEY) || '[]');
        accountsCache = Array.isArray(accounts) ? accounts : [];
    } catch {
        accountsCache = [];
    }
    return accountsCache;
}

const accountsReady = loadAccounts();

function getAllAccounts() {
    return accountsCache;
}

async function saveAllAccounts(accounts) {
    if (!Array.isArray(accounts)) {
        throw new Error('Accounts must be an array');
    }

    accountsCache = accounts.map((account) => ({
        ...account,
        email: String(account.email || '').toLowerCase(),
        role: normalizeRole(account.role)
    }));
    localStorage.setItem(ACCOUNTS_STORAGE_KEY, JSON.stringify(accountsCache));
}

function normalizeRole(role) {
    return role === 'driver' ? 'driver' : 'user';
}

function setCurrentUser(user) {
    const currentUser = {
        name: user.name,
        email: user.email,
        id: user.id,
        role: normalizeRole(user.role),
        expiresAt: Date.now() + LOGIN_SESSION_TIMEOUT_MS
    };
    sessionStorage.setItem(CURRENT_USER_KEY, JSON.stringify(currentUser));
    return currentUser;
}

function getCurrentUser() {
    try {
        const currentUser = JSON.parse(sessionStorage.getItem(CURRENT_USER_KEY) || 'null');
        if (!currentUser) {
            return null;
        }

        if (currentUser.expiresAt && Date.now() > Number(currentUser.expiresAt)) {
            sessionStorage.removeItem(CURRENT_USER_KEY);
            return null;
        }

        return currentUser;
    } catch {
        return null;
    }
}

document.addEventListener('DOMContentLoaded', async () => {
    await accountsReady;
    const formsContainer = document.querySelector('.forms');
    const signInButton = document.querySelector('.signIn');
    const signUpButton = document.querySelector('.signUp');
    const signInForm = document.querySelector('#loginForm');
    const registerForm = document.querySelector('#registerForm');
    const firstStage = document.querySelector('#stage1');
    const secondStage = document.querySelector('#stage2');
    const nextButton = document.querySelector('#stage1 .next-btn');
    const previousButton = document.querySelector('#stage2 .previous-btn');
    const passwordToggles = document.querySelectorAll('.password-toggle, .passwordshow i');
    const isDriverLogin = window.location.pathname.toLowerCase().includes('driver');
    const homePage = isDriverLogin ? 'DriverHome.html' : 'UserHome.html';
    const currentRole = isDriverLogin ? 'driver' : 'user';

    const getField = (id) => document.querySelector(`#${id}`);
    const registerIdField = getField('register-id');

    registerIdField?.addEventListener('input', () => {
        registerIdField.value = registerIdField.value.toUpperCase();
    });

    passwordToggles.forEach((toggle) => {
        toggle.addEventListener('click', () => {
            const passwordField = toggle.parentElement.querySelector('.inputs');
            const isVisible = passwordField.type === 'text';

            passwordField.type = isVisible ? 'password' : 'text';
            if (toggle.classList.contains('password-toggle')) {
                toggle.classList.toggle('is-visible', !isVisible);
            } else {
                toggle.classList.toggle('fa-eye', isVisible);
                toggle.classList.toggle('fa-eye-slash', !isVisible);
            }
            toggle.setAttribute('aria-pressed', String(!isVisible));
            toggle.setAttribute('aria-label', isVisible ? 'Show password' : 'Hide password');
        });

        toggle.addEventListener('keydown', (event) => {
            if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                toggle.click();
            }
        });
    });

    function showPanel(panel) {
        const isSignup = panel === 'signup';
        formsContainer?.classList.toggle('show-signup', isSignup);
        signInButton?.classList.toggle('active', !isSignup);
        signUpButton?.classList.toggle('active', isSignup);
    }

    function showStage(stage) {
        const isFirstStage = stage === 1;
        firstStage?.classList.toggle('active', isFirstStage);
        secondStage?.classList.toggle('active', !isFirstStage);
    }

    function validateFirstStage() {
        const name = getField('register-name')?.value.trim();
        const email = getField('register-email')?.value.trim();
        const id = getField('register-id')?.value.trim();

        if (!name || !email || !id) {
            alert('Please fill in your full name, email, and ID.');
            return false;
        }

        return true;
    }

    function validateSecondStage() {
        const password = getField('register-password')?.value;
        const confirmPassword = getField('confirm-password')?.value;

        if (!password || !confirmPassword) {
            alert('Please fill in both password fields.');
            return false;
        }

        if (password !== confirmPassword) {
            alert('Confirmed passwords do not match.');
            return false;
        }

        return true;
    }

    function getRegisteredUsers() {
        return getAllAccounts().filter((account) => account.role === currentRole);
    }

    async function saveRegisteredUser(user) {
        const accounts = await loadAccounts();
        accounts.push({
            ...user,
            email: user.email.toLowerCase(),
            role: normalizeRole(user.role)
        });
        await saveAllAccounts(accounts);
    }

    nextButton?.addEventListener('click', () => {
        if (validateFirstStage()) showStage(2);
    });

    previousButton?.addEventListener('click', () => {
        showStage(1);
    });

    signInButton?.addEventListener('click', () => showPanel('signin'));
    signUpButton?.addEventListener('click', () => showPanel('signup'));

    signInForm?.addEventListener('submit', async (event) => {
        event.preventDefault();

        const email = getField('login-email')?.value.trim();
        const password = getField('login-password')?.value;

        if (!email || !password) {
            alert('Please fill in your email and password.');
            return;
        }

        const user = getAllAccounts().find((registeredUser) => (
            registeredUser.email === email.toLowerCase() &&
            registeredUser.password === password &&
            registeredUser.role === currentRole
        ));

        if (!user) {
            alert('Incorrect email or password.');
            return;
        }

        setCurrentUser({
            name: user.name,
            email: user.email,
            id: user.id,
            role: user.role
        });
        window.location.href = homePage;
    });

    registerForm?.addEventListener('submit', async (event) => {
        event.preventDefault();

        if (!validateFirstStage() || !validateSecondStage()) {
            showStage(1);
            return;
        }

        const email = getField('register-email').value.trim().toLowerCase();
        const accounts = await loadAccounts();

        if (accounts.some((user) => user.email === email && user.role === currentRole)) {
            alert('An account with this email already exists for this role.');
            showPanel('signin');
            return;
        }

        const newUser = {
            name: getField('register-name').value.trim(),
            email,
            id: getField('register-id').value.trim(),
            password: getField('register-password').value,
            role: currentRole
        };

        try {
            await saveRegisteredUser(newUser);
        } catch {
            alert('Unable to save your account. Start the project server and try again.');
            return;
        }
        setCurrentUser(newUser);
        window.location.replace(homePage);
    });

    showStage(1);
    showPanel('signin');
});


const navToggle = document.querySelector('.nav-toggle');
const navLinks = document.querySelector('.nav-links');
const contentTrack = document.querySelector('#content-track');

if (navToggle && navLinks && contentTrack) {
    const navigationLinks = document.querySelectorAll('.nav-link');
    const contentPanels = document.querySelectorAll('.content-panel');
    const isDriverHome = Boolean(document.querySelector('#bus-update-form'));
    const panels = isDriverHome
        ? ['home', 'update-bus', 'update-history', 'profile']
        : ['home', 'your-bus', 'buses-routes', 'profile'];
    const currentUser = getCurrentUser();
    const accountLink = document.querySelector('#account-link');
    const expectedRole = isDriverHome ? 'driver' : 'user';
    const activeUser = currentUser?.role === expectedRole ? currentUser : null;

    if (accountLink && !activeUser) {
        accountLink.textContent = 'Login';
        accountLink.href = isDriverHome ? 'DriverLoginSystem.html' : 'UserLoginSystem.html';
    }

    function showPanel(panelIndex) {
        contentPanels.forEach((panel, index) => panel.classList.toggle('is-active', index === panelIndex));
        navigationLinks.forEach((link) => link.classList.toggle('is-active', link.dataset.panel === String(panelIndex)));
        navLinks.classList.remove('is-open');
        navToggle.setAttribute('aria-expanded', 'false');
    }

    navToggle.addEventListener('click', () => {
        const isOpen = navLinks.classList.toggle('is-open');
        navToggle.setAttribute('aria-expanded', String(isOpen));
        navToggle.setAttribute('aria-label', isOpen ? 'Close navigation' : 'Open navigation');
    });

    navigationLinks.forEach((link, index) => {
        if (link === accountLink && !activeUser) return;

        const mappedIndex = index < panels.length ? index : panels.length - 1;
        link.dataset.panel = String(mappedIndex);
        link.addEventListener('click', (event) => {
            event.preventDefault();
            showPanel(mappedIndex);
            window.history.replaceState(null, '', `#${panels[mappedIndex]}`);
        });
    });

    const setProfile = async () => {
        const profileMessage = document.querySelector('#profile-message');
        const profileName = document.querySelector('#profile-name');
        const profileEmail = document.querySelector('#profile-email');
        const profileId = document.querySelector('#profile-id');

        if (!activeUser) {
            if (profileMessage) profileMessage.textContent = 'No active login session was found.';
            return;
        }

        await accountsReady;
        const savedProfile = getAllAccounts().find((account) => (
            account.email === activeUser.email &&
            account.role === activeUser.role
        )) || activeUser;

        if (profileName) profileName.textContent = savedProfile.name || 'Not available';
        if (profileEmail) profileEmail.textContent = savedProfile.email || 'Not available';
        if (profileId) profileId.textContent = savedProfile.id || 'Not available';
    };

    setProfile();

    if (isDriverHome) {
        const historyKey = `busTrackingDriverHistory:${activeUser?.email || 'guest'}`;
        const routesKey = 'busTrackingRoutes';
        const renderHistory = () => {
            const history = JSON.parse(localStorage.getItem(historyKey) || '[]');
            const historyList = document.querySelector('#history-list');
            const escapeHtml = (value) => String(value).replace(/[&<>'"]/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[character]));
            historyList.innerHTML = history.length ? history.map((entry) => `<div class="history-item"><strong>${escapeHtml(entry.status)}</strong><span>${escapeHtml(entry.location)}</span><time>${escapeHtml(entry.time)}</time></div>`).join('') : '<p class="empty-history">No bus updates yet.</p>';
        };

        document.querySelector('#stop-count').addEventListener('change', (event) => {
            const count = Number(event.target.value);
            document.querySelector('#stopping-fields').innerHTML = Array.from({ length: count }, (_, index) => `<label for="pickup-point-${index}">Pickup Point ${index + 1} name</label><input id="pickup-point-${index}" class="route-stop" type="text" placeholder="Enter Pickup Point ${index + 1} name" required><label for="pickup-point-time-${index}">Pickup Point ${index + 1} time</label><input id="pickup-point-time-${index}" class="route-stop-time" type="time" required>`).join('');
        });

        document.querySelector('#bus-update-form').addEventListener('submit', (event) => {
            event.preventDefault();
            const busNo = document.querySelector('#bus-number').value.trim();
            const pickupPoints = Array.from(document.querySelectorAll('.route-stop')).map((field) => field.value.trim());
            const route = {
                busNo,
                status: document.querySelector('#bus-status').value,
                startingStop: pickupPoints[0] || '',
                stops: pickupPoints,
                pickupTimes: Array.from(document.querySelectorAll('.route-stop-time')).map((field) => field.value),
                driver: activeUser?.name || 'Driver',
                updatedAt: new Date().toLocaleString()
            };
            const routes = JSON.parse(localStorage.getItem(routesKey) || '[]');
            const existingIndex = routes.findIndex((item) => item.busNo.toLowerCase() === busNo.toLowerCase());
            if (existingIndex >= 0) routes[existingIndex] = route;
            else routes.unshift(route);
            localStorage.setItem(routesKey, JSON.stringify(routes));
            const history = JSON.parse(localStorage.getItem(historyKey) || '[]');
            history.unshift({ status: route.status, location: `${route.busNo}: ${route.startingStop}`, time: new Date().toLocaleString() });
            localStorage.setItem(historyKey, JSON.stringify(history.slice(0, 10)));
            document.querySelector('#bus-update-message').textContent = 'Bus route created and shared with users.';
            renderHistory();
        });
        renderHistory();
    } else {
        const selectedBusKey = `busTrackingSelectedBus:${activeUser?.email || 'guest'}`;
        const escapeHtml = (value) => String(value).replace(/[&<>'"]/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[character]));
        const getRoutes = () => JSON.parse(localStorage.getItem('busTrackingRoutes') || '[]');
        const formatSchedule = (route) => route.stops.map((stop, index) => {
            const time = route.pickupTimes?.[index] || 'Time not set';
            return `${escapeHtml(stop)} (${escapeHtml(time)})`;
        }).join(' &rarr; ');
        const renderYourBus = () => {
            const selected = JSON.parse(localStorage.getItem(selectedBusKey) || 'null');
            if (!selected) return;
            document.querySelector('#your-bus-message').textContent = 'Your selected bus route is shown below.';
            document.querySelector('#your-bus-details').innerHTML = `<div class="info-item"><strong>Bus number</strong><span>${escapeHtml(selected.busNo)}</span></div><div class="info-item"><strong>Status</strong><span>${escapeHtml(selected.status)}</span></div><div class="info-item"><strong>Route</strong><span>${selected.stops.map(escapeHtml).join(' &rarr; ')}</span></div><div class="info-item"><strong>Bus timing</strong><span>${formatSchedule(selected)}</span></div>`;
        };
        const renderRoutes = () => {
            const query = document.querySelector('#route-search').value.trim().toLowerCase();
            const results = getRoutes().filter((route) => !query || [route.busNo, route.status, route.startingStop, route.driver, ...route.stops].join(' ').toLowerCase().includes(query));
            document.querySelector('#route-results').innerHTML = results.length ? results.map((route) => `<div class="route-card"><div><strong>Bus ${escapeHtml(route.busNo)}</strong><span>${escapeHtml(route.status)}</span></div><p>Route: ${route.stops.map(escapeHtml).join(' &rarr; ')}</p><p>Timing: ${formatSchedule(route)}</p><small>Driver: ${escapeHtml(route.driver)}</small><label class="select-route"><input type="checkbox" class="route-check" data-bus="${escapeHtml(route.busNo)}"> Add to Your Bus</label></div>`).join('') : '<p class="empty-results">No matching buses or routes.</p>';
            document.querySelectorAll('.route-check').forEach((checkbox) => checkbox.addEventListener('change', () => {
                const selected = getRoutes().find((route) => route.busNo === checkbox.dataset.bus);
                if (checkbox.checked && selected) localStorage.setItem(selectedBusKey, JSON.stringify(selected));
                renderYourBus();
            }));
        };
        document.querySelector('#route-search').addEventListener('input', renderRoutes);
        renderRoutes();
        renderYourBus();
    }

    const initialPanel = panels.indexOf(window.location.hash.slice(1));
    showPanel(initialPanel > 0 ? initialPanel : 0);
}

let slideIndex = 1;
let slideTimer;

function plusSlides(step) {
    showSlides(slideIndex + step);
}

function currentSlide(slideNumber) {
    showSlides(slideNumber);
}

function showSlides(slideNumber) {
    const slides = document.querySelectorAll('.mySlides');
    const dots = document.querySelectorAll('.dot');

    if (!slides.length) return;
    if (slideNumber > slides.length) slideIndex = 1;
    else if (slideNumber < 1) slideIndex = slides.length;
    else slideIndex = slideNumber;

    slides.forEach((slide) => {
    slide.style.display = 'none';
    });
    dots.forEach((dot) => {
    dot.classList.remove('active');
    });

    slides[slideIndex - 1].style.display = 'block';
    dots[slideIndex - 1]?.classList.add('active');
    clearInterval(slideTimer);
    slideTimer = setInterval(() => showSlides(slideIndex + 1), 5000);
}

showSlides(slideIndex);