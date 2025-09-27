document.addEventListener('DOMContentLoaded', () => {
  const statusEl = document.getElementById('status');
  const plantBtn = document.getElementById('plantPotato');

  plantBtn.addEventListener('click', () => {
    plantPotato();
  });

  function plantPotato() {
    statusEl.textContent = 'Kartoffel wird gepflanzt …';
    setTimeout(() => {
      statusEl.textContent = 'Kartoffel geerntet! (verkaufbar)';
    }, 5000); // 5 Sekunden Dummy-Timer
  }
});