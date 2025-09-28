document.addEventListener("DOMContentLoaded", () => {
  // ✅ Konfiguration
  const SUPABASE_URL = "https://uduyudbdybaeaurxzzq.supabase.co";
  const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."; // dein echter Key
  const supabase = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

  // ✅ UI-Elemente
  const loginBtn = document.getElementById("login");
  const logoutBtn = document.getElementById("logout");
  const plantBtn = document.getElementById("plant-potato");
  const sellBtn = document.getElementById("sell-potato");
  const authSection = document.getElementById("auth-section");
  const gameSection = document.getElementById("game-section");
  const emailDisplay = document.getElementById("user-email");
  const potatoCount = document.getElementById("potato-count");
  const moneyCount = document.getElementById("money-count");

  let sessionUser = null;
  let inventory = { kartoffeln: 0, geld: 0 };

  // ✅ Anonymes Login
  loginBtn.addEventListener("click", async () => {
    const { data, error } = await supabase.auth.signInAnonymously();

    if (error) {
      console.error("Fehler beim Anonym-Login:", error.message);
      alert("Fehler: " + error.message);
    } else {
      sessionUser = data.user;
      await loadOrCreateInventory();
      updateUI();
      alert("Anonym eingeloggt ✅");
    }
  });

  // ✅ Logout
  logoutBtn.addEventListener("click", async () => {
    await supabase.auth.signOut();
    location.reload();
  });

  // ✅ Session prüfen
  supabase.auth.getSession().then(async ({ data: { session } }) => {
    if (session) {
      sessionUser = session.user;
      await loadOrCreateInventory();
      updateUI();
    }
  });

  // ✅ Inventar aus Supabase laden oder anlegen
  async function loadOrCreateInventory() {
    const { data, error } = await supabase
      .from("inventar")
      .select("*")
      .eq("user_id", sessionUser.id)
      .single();

    if (data) {
      inventory = { kartoffeln: data.kartoffeln, geld: data.geld };
    } else {
      await supabase.from("inventar").insert({
        user_id: sessionUser.id,
        kartoffeln: 0,
        geld: 0,
      });
      inventory = { kartoffeln: 0, geld: 0 };
    }
  }

  // ✅ UI aktualisieren
  function updateUI() {
    authSection.style.display = "none";
    gameSection.style.display = "block";
    emailDisplay.textContent = sessionUser.email || "Anonymer Spieler";
    potatoCount.textContent = inventory.kartoffeln;
    moneyCount.textContent = inventory.geld;
  }

  // ✅ Kartoffel pflanzen
  plantBtn.addEventListener("click", async () => {
    inventory.kartoffeln += 1;
    await supabase
      .from("inventar")
      .update({ kartoffeln: inventory.kartoffeln })
      .eq("user_id", sessionUser.id);
    updateUI();
  });

  // ✅ Kartoffel verkaufen
  sellBtn.addEventListener("click", async () => {
    if (inventory.kartoffeln > 0) {
      inventory.kartoffeln -= 1;
      inventory.geld += 5;
      await supabase
        .from("inventar")
        .update({
          kartoffeln: inventory.kartoffeln,
          geld: inventory.geld,
        })
        .eq("user_id", sessionUser.id);
      updateUI();
    } else {
      alert("Keine Kartoffeln zum Verkaufen!");
    }
  });
});