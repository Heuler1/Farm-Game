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
  const gameSection = document.get