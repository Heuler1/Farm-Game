alert("✅ main.js wurde geladen");

document.addEventListener("DOMContentLoaded", () => {
  // ✅ Supabase-Konfiguration
  const { createClient } = supabase;
  const SUPABASE_URL = "https://uduyudbdybaeaurxzzq.supabase.co";
  const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."; // dein echter Public Anon Key
  const client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

  // 🔗 UI-Elemente
  const loginBtn = document.getElementById("login");
  const logoutBtn = document.getElementById("logout");
  const plantBtn = document.getElementById("plant-potato");
  const sellBtn = document.getElementById("sell-potato");
  const emailInput = document.getElementById("email");
  const authSection = document.getElementById("auth-section");
  const gameSection = document.getElementById("game-section");
  const emailDisplay = document.getElementById("user-email");
  const potatoCount = document.getElementById("potato-count");
  const moneyCount = document.getElementById("money-count");

  let sessionUser = null;
  let inventory = { kartoffeln: 0, geld: 0 };

  // 🔐 Login (Magic Link oder anonym)
  loginBtn.addEventListener("click", async () => {
    const email = emailInput.value.trim();

    if (!email) {
      console.log("⚠️ Kein E-Mail eingegeben – mache anonymen Login");
      const { data, error } = await client.auth.signInAnonymously();
      if (error) return alert("Anonymer Login fehlgeschlagen: " + error.message);
      sessionUser = data.user;
      await loadOrCreateInventory();
      updateUI();
      alert("Anonym eingeloggt ✅");
      return;
    }

    console.log("📨 Versuche Magic Link an:", email);
    const { error } = await client.auth.signInWithOtp({ email });

    if (error) {
      console.error("❌ Fehler beim Login:", error.message);
      alert("Fehler: " + error.message);
    } else {
      alert("✅ Magic Link wurde an " + email + " gesendet!");
    }
  });

  // 🔁 Session prüfen
  client.auth.getSession().then(async ({ data: { session } }) => {
    if (session) {
      sessionUser = session.user;
      await loadOrCreateInventory();
      updateUI();
    }
  });

  // 🔐 Logout
  logoutBtn.addEventListener("click", async () => {
    await client.auth.signOut();
    location.reload();
  });

  // 📦 Inventar laden oder neu anlegen
  async function loadOrCreateInventory() {
    const { data } = await client
      .from("inventar")
      .select("*")
      .eq("user_id", sessionUser.id)
      .single();

    if (data) {
      inventory = { kartoffeln: data.kartoffeln, geld: data.geld };
    } else {
      await client.from("inventar").insert({
        user_id: sessionUser.id,
        kartoffeln: 0,
        geld: 0,
      });
      inventory = { kartoffeln: 0, geld: 0 };
    }
  }

  // 🧱 UI aktualisieren
  function updateUI() {
    authSection.style.display = "none";
    gameSection.style.display = "block";
    emailDisplay.textContent = sessionUser.email || "Anonymer Spieler";
    potatoCount.textContent = inventory.kartoffeln;
    moneyCount.textContent = inventory.geld;
  }

  // 🥔 Kartoffel pflanzen
  plantBtn.addEventListener("click", async () => {
    inventory.kartoffeln += 1;
    await client
      .from("inventar")
      .update({ kartoffeln: inventory.kartoffeln })
      .eq("user_id", sessionUser.id);
    updateUI();
  });

  // 💰 Kartoffel verkaufen
  sellBtn.addEventListener("click", async () => {
    if (inventory.kartoffeln > 0) {
      inventory.kartoffeln -= 1;
      inventory.geld += 5;
      await client
        .from("inventar")
        .update({
          kartoffeln: inventory.kartoffeln,
          geld: inventory.geld,
        })
        .eq("user_id", sessionUser.id);
      updateUI();
    } else {
      alert("❗ Keine Kartoffeln zum Verkaufen.");
    }
  });
});