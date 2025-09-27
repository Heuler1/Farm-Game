const SUPABASE_URL = "https://uduyudbdybaeaeurxzzq.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVkdXl1ZGJkeWJhZWFldXJ4enpxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg5ODc4NzMsImV4cCI6MjA3NDU2Mzg3M30.hHoMkh8YtB_GKquz0hTu2_kaJWbHSbBAVBcYyBZRpSU";
const supabase = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

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

async function checkSession() {
  const { data } = await supabase.auth.getSession();
  if (data.session) {
    sessionUser = data.session.user;
    await loadOrCreateInventory();
    updateUI();
  }
}

loginBtn.addEventListener("click", async () => {
  const { error } = await supabase.auth.signInWithOtp({
    email: emailInput.value,
  });
  alert("Magic Link gesendet! Bitte Posteingang prüfen.");
});

logoutBtn.addEventListener("click", async () => {
  await supabase.auth.signOut();
  location.reload();
});

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

function updateUI() {
  authSection.style.display = "none";
  gameSection.style.display = "block";
  emailDisplay.textContent = sessionUser.email;
  potatoCount.textContent = inventory.kartoffeln;
  moneyCount.textContent = inventory.geld;
}

plantBtn.addEventListener("click", async () => {
  inventory.kartoffeln += 1;
  await supabase
    .from("inventar")
    .update({ kartoffeln: inventory.kartoffeln })
    .eq("user_id", sessionUser.id);
  updateUI();
});

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

checkSession();