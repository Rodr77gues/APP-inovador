// app.js

let currentUser = null;
let stations = [];
let map;
let userMarker;
let stationsMarkers = [];
let activeChat = null; // { matchId, userId, name }

// Elementos
const splashScreen = document.getElementById("splash-screen");
const authScreen = document.getElementById("auth-screen");
const mainScreen = document.getElementById("main-screen");

const loginForm = document.getElementById("login-form");
const signupForm = document.getElementById("signup-form");
const googleLoginBtn = document.getElementById("google-login");

const profileModal = document.getElementById("profile-modal");
const closeProfileModalBtn = document.getElementById("close-profile-modal");
const profileForm = document.getElementById("profile-form");
const profileNameInput = document.getElementById("profile-name");
const entryStationSelect = document.getElementById("entry-station");
const exitStationSelect = document.getElementById("exit-station");
const btnOpenProfile = document.getElementById("btn-open-profile");
const btnEditRoute = document.getElementById("btn-edit-route");
const btnLogout = document.getElementById("btn-logout");

const matchesList = document.getElementById("matches-list");
const matchesCount = document.getElementById("matches-count");
const currentRouteText = document.getElementById("current-route-text");
const locationStatus = document.getElementById("location-status");

const chatModal = document.getElementById("chat-modal");
const closeChatModalBtn = document.getElementById("close-chat-modal");
const chatTitle = document.getElementById("chat-title");
const chatSubtitle = document.getElementById("chat-subtitle");
const chatMessagesEl = document.getElementById("chat-messages");
const chatForm = document.getElementById("chat-form");
const chatInputText = document.getElementById("chat-input-text");
const chatPreviewList = document.getElementById("chat-preview-list");
const unreadCountBadge = document.getElementById("unread-count");

const toastEl = document.getElementById("toast");

const navButtons = document.querySelectorAll(".nav-item");
const tabButtons = document.querySelectorAll(".tab-button");
const tabContents = document.querySelectorAll(".tab-content");

// ---- UI Helpers ----

function showToast(message) {
  toastEl.textContent = message;
  toastEl.classList.remove("hidden");
  setTimeout(() => toastEl.classList.add("hidden"), 3500);
}

function showScreen(screen) {
  authScreen.classList.add("hidden");
  mainScreen.classList.add("hidden");

  if (screen === "auth") authScreen.classList.remove("hidden");
  if (screen === "main") mainScreen.classList.remove("hidden");
}

function openModal(modal) {
  modal.classList.remove("hidden");
}

function closeModal(modal) {
  modal.classList.add("hidden");
}

// Tabs (login / cadastro)
tabButtons.forEach((btn) => {
  btn.addEventListener("click", () => {
    const tab = btn.dataset.tab;

    tabButtons.forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");

    tabContents.forEach((content) => {
      content.classList.toggle("active", content.id.startsWith(tab));
    });
  });
});

// Nav inferior (no momento é visual, mas já deixamos pronto)
navButtons.forEach((btn) => {
  btn.addEventListener("click", () => {
    navButtons.forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    // Se quiser telas diferentes para matches/mensagens, pode alternar aqui
  });
});

// ---- Auth ----

loginForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const email = document.getElementById("login-email").value.trim();
  const password = document.getElementById("login-password").value;

  try {
    await auth.signInWithEmailAndPassword(email, password);
    showToast("Bem-vindo de volta 👋");
  } catch (err) {
    console.error(err);
    showToast("Erro ao entrar: " + err.message);
  }
});

signupForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const name = document.getElementById("signup-name").value.trim();
  const email = document.getElementById("signup-email").value.trim();
  const password = document.getElementById("signup-password").value;

  try {
    const cred = await auth.createUserWithEmailAndPassword(email, password);
    await cred.user.updateProfile({ displayName: name });

    await db.collection("users").doc(cred.user.uid).set({
      name,
      email,
      entryStationId: null,
      exitStationId: null,
      timeGo: null,
      timeBack: null,
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
    });

    showToast("Conta criada com sucesso 🎉");
  } catch (err) {
    console.error(err);
    showToast("Erro ao cadastrar: " + err.message);
  }
});

googleLoginBtn.addEventListener("click", async () => {
  const provider = new firebase.auth.GoogleAuthProvider();
  try {
    const result = await auth.signInWithPopup(provider);
    const { user } = result;

    const userDoc = await db.collection("users").doc(user.uid).get();
    if (!userDoc.exists) {
      await db.collection("users").doc(user.uid).set({
        name: user.displayName || "Usuário NextStop",
        email: user.email,
        entryStationId: null,
        exitStationId: null,
        timeGo: null,
        timeBack: null,
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      });
    }

    showToast("Login com Google realizado ✅");
  } catch (err) {
    console.error(err);
    showToast("Erro ao entrar com Google: " + err.message);
  }
});

btnLogout.addEventListener("click", async () => {
  await auth.signOut();
  showToast("Você saiu da sua conta.");
});

// Listener de autenticação
auth.onAuthStateChanged(async (user) => {
  currentUser = user;
  if (!user) {
    showScreen("auth");
    return;
  }

  showScreen("main");
  loadUserProfile(user.uid);
  subscribeToMatches(user.uid);
  subscribeToChats(user.uid);
});

// ---- Perfil / Rota ----

btnOpenProfile.addEventListener("click", () => {
  openModal(profileModal);
});

btnEditRoute.addEventListener("click", () => {
  openModal(profileModal);
});

closeProfileModalBtn.addEventListener("click", () => {
  closeModal(profileModal);
});

profileForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  if (!currentUser) return;

  const name = profileNameInput.value.trim();
  const entryStationId = entryStationSelect.value;
  const exitStationId = exitStationSelect.value;
  const timeGo = document.getElementById("time-go").value || null;
  const timeBack = document.getElementById("time-back").value || null;

  try {
    await db.collection("users").doc(currentUser.uid).set(
      {
        name,
        entryStationId,
        exitStationId,
        timeGo,
        timeBack,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    currentRouteText.textContent = buildRouteText(entryStationId, exitStationId);
    showToast("Rota atualizada com sucesso ✅");
    closeModal(profileModal);
  } catch (err) {
    console.error(err);
    showToast("Erro ao salvar rota: " + err.message);
  }
});

async function loadUserProfile(uid) {
  try {
    const snap = await db.collection("users").doc(uid).get();
    if (!snap.exists) return;
    const data = snap.data();

    profileNameInput.value = data.name || "";

    if (data.entryStationId) entryStationSelect.value = data.entryStationId;
    if (data.exitStationId) exitStationSelect.value = data.exitStationId;

    currentRouteText.textContent = buildRouteText(
      data.entryStationId,
      data.exitStationId
    );
  } catch (err) {
    console.error(err);
  }
}

function buildRouteText(entryId, exitId) {
  if (!entryId || !exitId) {
    return "Defina a estação de entrada e saída para encontrar pessoas no mesmo trajeto.";
  }
  const entry = stations.find((s) => s.id === entryId);
  const exit = stations.find((s) => s.id === exitId);
  if (!entry || !exit) return "Rota configurada.";

  return `${entry.nome} ➜ ${exit.nome}`;
}

// ---- Estações & Mapa ----

async function loadStations() {
  const res = await fetch("estacoes.json");
  stations = await res.json();
  populateStationSelects();
}

function populateStationSelects() {
  const options = stations
    .map((s) => `<option value="${s.id}">${s.nome} (${s.linha})</option>`)
    .join("");

  entryStationSelect.innerHTML = `<option value="">Selecione...</option>${options}`;
  exitStationSelect.innerHTML = `<option value="">Selecione...</option>${options}`;
}

function initMap() {
  const defaultCenter = { lat: -23.5505, lng: -46.6333 }; // Centro SP

  map = new google.maps.Map(document.getElementById("map"), {
    center: defaultCenter,
    zoom: 11,
    disableDefaultUI: true,
    styles: [
      {
        featureType: "poi",
        stylers: [{ visibility: "off" }],
      },
    ],
  });

  // Marcadores de estações
  stationsMarkers = stations.map((station) => {
    const marker = new google.maps.Marker({
      position: { lat: station.latitude, lng: station.longitude },
      map,
      title: station.nome,
      icon: {
        path: google.maps.SymbolPath.CIRCLE,
        scale: 4,
        fillColor: station.tipo === "CPTM" ? "#22c55e" : "#4f46e5",
        fillOpacity: 1,
        strokeWeight: 1,
        strokeColor: "#020617",
      },
    });

    const info = new google.maps.InfoWindow({
      content: `<strong>${station.nome}</strong><br>${station.linha}`,
    });

    marker.addListener("click", () => {
      info.open(map, marker);
    });

    return marker;
  });

  // Geolocalização do usuário
  if ("geolocation" in navigator) {
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        const position = { lat: latitude, lng: longitude };
        locationStatus.textContent = "Localização encontrada";

        userMarker = new google.maps.Marker({
          position,
          map,
          title: "Você",
          icon: {
            path: google.maps.SymbolPath.CIRCLE,
            scale: 6,
            fillColor: "#f97316",
            fillOpacity: 1,
            strokeWeight: 2,
            strokeColor: "#020617",
          },
        });

        map.setCenter(position);
        map.setZoom(13);
      },
      () => {
        locationStatus.textContent = "Não foi possível obter a localização";
      }
    );
  } else {
    locationStatus.textContent = "Geolocalização não suportada";
  }
}

// ---- Matches ----

let matchesUnsub = null;

function subscribeToMatches(uid) {
  if (matchesUnsub) matchesUnsub();

  matchesUnsub = db
    .collection("matches")
    .where("participants", "array-contains", uid)
    .orderBy("updatedAt", "desc")
    .onSnapshot((snapshot) => {
      const matches = [];
      snapshot.forEach((doc) => {
        matches.push({ id: doc.id, ...doc.data() });
      });

      renderMatches(matches);
    });
}

function renderMatches(matches) {
  matchesCount.textContent =
    matches.length === 1
      ? "1 pessoa"
      : `${matches.length} pessoas`;

  matchesList.innerHTML = "";

  if (matches.length === 0) {
    matchesList.innerHTML =
      '<li class="list-item"><div class="list-info"><p class="list-title">Nenhum match ainda</p><p class="list-subtitle">Assim que alguém tiver um trajeto igual ao seu, aparecerá aqui.</p></div></li>';
    return;
  }

  matches.forEach((match) => {
    const otherUser =
      match.users && match.users.find((u) => u.id !== currentUser.uid);
    const li = document.createElement("li");
    li.className = "list-item";
    li.innerHTML = `
      <div class="list-avatar">
        ${otherUser?.name?.[0]?.toUpperCase() || "N"}
      </div>
      <div class="list-info">
        <p class="list-title">${otherUser?.name || "Usuário NextStop"}</p>
        <p class="list-subtitle">
          ${match.routeLabel || "Rota similar à sua"}
        </p>
      </div>
    `;

    li.addEventListener("click", () => {
      openChatFromMatch(match, otherUser);
    });

    matchesList.appendChild(li);
  });
}

// ---- Chats & Mensagens ----

let chatsUnsub = null;
let messagesUnsub = null;

function subscribeToChats(uid) {
  if (chatsUnsub) chatsUnsub();

  chatsUnsub = db
    .collection("chats")
    .where("participants", "array-contains", uid)
    .orderBy("lastMessageAt", "desc")
    .onSnapshot((snapshot) => {
      const chats = [];
      snapshot.forEach((doc) => chats.push({ id: doc.id, ...doc.data() }));
      renderChatPreviews(chats);
      updateUnreadCount(chats);
    });
}

function renderChatPreviews(chats) {
  chatPreviewList.innerHTML = "";

  if (chats.length === 0) {
    chatPreviewList.innerHTML =
      '<div class="list-item"><div class="list-info"><p class="list-title">Nenhuma conversa ainda</p><p class="list-subtitle">Quando você der match com alguém, a conversa aparecerá aqui.</p></div></div>';
    return;
  }

  chats.forEach((chat) => {
    const other = chat.users?.find((u) => u.id !== currentUser.uid);
    const lastMsg = chat.lastMessage || "";
    const li = document.createElement("div");
    li.className = "list-item";

    const hasUnread = chat.unread && chat.unread[currentUser.uid] > 0;
    const unreadBadge = hasUnread
      ? `<span class="badge alert">${chat.unread[currentUser.uid]} nova(s)</span>`
      : "";

    li.innerHTML = `
      <div class="list-avatar">${other?.name?.[0]?.toUpperCase() || "N"}</div>
      <div class="list-info">
        <p class="list-title">${other?.name || "Usuário NextStop"}</p>
        <p class="list-subtitle">${lastMsg || "Comece a conversa 👋"}</p>
      </div>
      ${unreadBadge}
    `;

    li.addEventListener("click", () => {
      openChat(chat.id, other);
    });

    chatPreviewList.appendChild(li);
  });
}

function updateUnreadCount(chats) {
  let total = 0;
  chats.forEach((c) => {
    if (c.unread && c.unread[currentUser.uid]) {
      total += c.unread[currentUser.uid];
    }
  });
  unreadCountBadge.textContent = `${total} novas`;
}

function openChatFromMatch(match, otherUser) {
  if (!match.chatId) {
    createChatFromMatch(match, otherUser);
  } else {
    openChat(match.chatId, otherUser);
  }
}

async function createChatFromMatch(match, otherUser) {
  if (!currentUser) return;

  const chatRef = db.collection("chats").doc();
  await chatRef.set({
    participants: [currentUser.uid, otherUser.id],
    users: match.users,
    createdAt: firebase.firestore.FieldValue.serverTimestamp(),
    lastMessage: null,
    lastMessageAt: null,
    unread: {
      [currentUser.uid]: 0,
      [otherUser.id]: 0,
    },
  });

  await db.collection("matches").doc(match.id).set(
    {
      chatId: chatRef.id,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
    },
    { merge: true }
  );

  openChat(chatRef.id, otherUser);
}

function openChat(chatId, otherUser) {
  activeChat = { chatId, otherUser };

  chatTitle.textContent = otherUser?.name || "Chat";
  chatSubtitle.textContent = "Vocês compartilham um trajeto parecido";

  openModal(chatModal);
  listenToMessages(chatId);

  // Zera unread para o usuário atual
  db.collection("chats")
    .doc(chatId)
    .set(
      {
        [`unread.${currentUser.uid}`]: 0,
      },
      { merge: true }
    );
}

function listenToMessages(chatId) {
  if (messagesUnsub) messagesUnsub();

  messagesUnsub = db
    .collection("chats")
    .doc(chatId)
    .collection("messages")
    .orderBy("createdAt", "asc")
    .onSnapshot((snapshot) => {
      const messages = [];
      snapshot.forEach((doc) => messages.push({ id: doc.id, ...doc.data() }));
      renderMessages(messages);
    });
}

function renderMessages(messages) {
  chatMessagesEl.innerHTML = "";

  messages.forEach((msg) => {
    const div = document.createElement("div");
    div.className = "message " + (msg.userId === currentUser.uid ? "me" : "them");
    const date = msg.createdAt?.toDate?.() || new Date(msg.createdAt || Date.now());
    const timeStr = date.toLocaleTimeString("pt-BR", {
      hour: "2-digit",
      minute: "2-digit",
    });

    div.innerHTML = `
      <div>${msg.text}</div>
      <div class="message-meta">${timeStr}</div>
    `;
    chatMessagesEl.appendChild(div);
  });

  chatMessagesEl.scrollTop = chatMessagesEl.scrollHeight;
}

chatForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  if (!activeChat || !currentUser) return;
  const text = chatInputText.value.trim();
  if (!text) return;

  const { chatId, otherUser } = activeChat;
  const messagesRef = db
    .collection("chats")
    .doc(chatId)
    .collection("messages");

  await messagesRef.add({
    text,
    userId: currentUser.uid,
    createdAt: firebase.firestore.FieldValue.serverTimestamp(),
  });

  // Atualiza "última mensagem" e unread
  await db
    .collection("chats")
    .doc(chatId)
    .set(
      {
        lastMessage: text,
        lastMessageAt: firebase.firestore.FieldValue.serverTimestamp(),
        [`unread.${otherUser.id}`]: firebase.firestore.FieldValue.increment(1),
      },
      { merge: true }
    );

  chatInputText.value = "";
});

closeChatModalBtn.addEventListener("click", () => {
  closeModal(chatModal);
});

// ---- Notificações (PWA / FCM) ----

async function initNotifications() {
  if (!("Notification" in window)) return;
  if (Notification.permission === "granted") {
    getFcmToken();
  } else if (Notification.permission !== "denied") {
    const perm = await Notification.requestPermission();
    if (perm === "granted") {
      getFcmToken();
    }
  }
}

async function getFcmToken() {
  try {
    const token = await messaging.getToken();
    if (!token || !currentUser) return;
    await db.collection("users").doc(currentUser.uid).set(
      {
        fcmToken: token,
      },
      { merge: true }
    );
  } catch (err) {
    console.error("Erro ao obter token FCM", err);
  }
}

// ---- Service Worker ----

if ("serviceWorker" in navigator) {
  window.addEventListener("load", async () => {
    try {
      await navigator.serviceWorker.register("sw.js");
      console.log("Service worker registrado");
    } catch (err) {
      console.error("Erro ao registrar service worker", err);
    }
  });
}

// ---- Inicialização geral ----

async function bootstrap() {
  try {
    await loadStations();
    // Espera o Maps carregar
    const checkMap = setInterval(() => {
      if (window.google && window.google.maps) {
        clearInterval(checkMap);
        initMap();
      }
    }, 150);
  } catch (err) {
    console.error(err);
  } finally {
    setTimeout(() => {
      splashScreen.classList.add("hidden");
    }, 900);
  }
}

bootstrap();
initNotifications();
