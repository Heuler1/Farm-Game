document.addEventListener("DOMContentLoaded", () => {
  alert("JavaScript geladen ✅");

  const SUPABASE_URL = "https://DEIN_PROJEKT.supabase.co";
  const SUPABASE_ANON_KEY = "DEIN_ANON_KEY";
  const supabase = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

  const loginBtn = document.getElementById("login");
  const logoutBtn = document.getElementById("logout");
  const emailInput = document.getElementById("email");
  const authSection = document.getElementById("auth-section");
  const gameSection = document.getElementById("game-section");
  const emailDisplay = document.getElementById("user-email");

  loginBtn.addEventListener("click", async () => {
    const email = emailInput.value;
    alert("Login wird versucht für: " + email);

    const { error } = await supabase.auth.signInWithOtp({ email });

    if (error) {
      console.error("Login-Fehler:", error.message);
      alert("Fehler: " + error.message);
    } else {
      alert("Magic Link gesendet! ✔️");
    }
  });

  logoutBtn?.addEventListener("click", async () => {
    await supabase.auth.signOut();
    location.reload();
  });

  supabase.auth.getSession().then(({ data: { session } }) => {
    if (session) {
      const user = session.user;
      authSection.style.display = "none";
      gameSection.style.display = "block";
      emailDisplay.textContent = user.email;
    }
  });
});