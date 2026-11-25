/* ============================================================
   OLA AI ECOSYSTEM PORTAL - APPLICATION LOGIC
   ============================================================ */

document.addEventListener('DOMContentLoaded', () => {
  initTabs();
  initCharts();
});

/* --- TAB NAVIGATION --- */
function initTabs() {
  const buttons = document.querySelectorAll('.nav-btn[data-tab]');
  const tabs = document.querySelectorAll('.tab-content');

  buttons.forEach(btn => {
    btn.addEventListener('click', () => {
      const targetTabId = btn.getAttribute('data-tab');

      buttons.forEach(b => b.classList.remove('active'));
      tabs.forEach(t => t.classList.remove('active'));

      btn.classList.add('active');
      document.getElementById(targetTabId).classList.add('active');
    });
  });
}

/* --- CHAT FUNCTIONS --- */
function sendMessage() {
  const input = document.getElementById('chat-input');
  const text = input.value.trim();

  if (!text) return;

  appendMessage('user', text);
  input.value = '';

  // Simulation typing response
  showTypingIndicator();

  setTimeout(() => {
    removeTypingIndicator();
    const response = getBotResponse(text);
    appendMessage('bot', response);
  }, 1000);
}

function sendQuickPrompt(promptText) {
  // Activate chat tab if not active
  document.getElementById('btn-tab-chat').click();
  const input = document.getElementById('chat-input');
  input.value = promptText;
  sendMessage();
}

function handleKeyPress(event) {
  if (event.key === 'Enter') {
    sendMessage();
  }
}

function appendMessage(sender, text) {
  const container = document.getElementById('chat-messages');
  const msgDiv = document.createElement('div');
  msgDiv.className = `message ${sender}`;

  msgDiv.innerHTML = `
    <div class="message-bubble">${escapeHtml(text)}</div>
  `;

  container.appendChild(msgDiv);
  container.scrollTop = container.scrollHeight;
}

function showTypingIndicator() {
  const container = document.getElementById('chat-messages');
  const indicator = document.createElement('div');
  indicator.className = 'message bot typing-indicator';
  indicator.id = 'typing-indicator';
  indicator.innerHTML = `
    <div class="message-bubble" style="color:var(--text-muted); font-style:italic;">
      <i class="fa-solid fa-spinner fa-spin"></i> Ola myśli...
    </div>
  `;
  container.appendChild(indicator);
  container.scrollTop = container.scrollHeight;
}

function removeTypingIndicator() {
  const indicator = document.getElementById('typing-indicator');
  if (indicator) {
    indicator.remove();
  }
}

function clearChat() {
  const container = document.getElementById('chat-messages');
  container.innerHTML = `
    <div class="message bot">
      <div class="message-bubble">
        Cześć! Jestem Ola — Twoja lokalna asystentka AI. W czym mogę Ci dzisiaj pomóc? Znam m.in. atrakcje Nowego Jorku oraz zbiory danych sprzedażowych!
      </div>
    </div>
  `;
}

function getBotResponse(userInput) {
  const inputLower = userInput.lower ? userInput.lower() : userInput.toLowerCase();

  if (inputLower.includes('nowym jorku') || inputLower.includes('nyc') || inputLower.includes('zobaczyć')) {
    return 'W Nowym Jorku warto zwiedzić Statuę Wolności, Times Square, Central Park, Metropolitan Museum of Art oraz przejść się Mostem Brooklińskim! Sprawdź naszą zakładkę "Przewodnik NYC", aby poznać szczegóły.';
  }
  if (inputLower.includes('muze') || inputLower.includes('sztuki')) {
    return 'Główne muzea w NYC to The Met (Metropolitan Museum of Art), MoMA (Museum of Modern Art), Muzeum Historii Naturalnej oraz Guggenheim Museum!';
  }
  if (inputLower.includes('sprzedaż') || inputLower.includes('dane') || inputLower.includes('analiz')) {
    return 'Do analizy rynku i sprzedaży zalecam segmentację produktów (ABC/XYZ), wyznaczenie wskaźników AOV i LTV oraz prognozowanie szeregów czasowych (Time Series Forecasting). Zobaczyć wizualizację danych w zakładce "Analityka & Sprzedaż"!';
  }
  if (inputLower.includes('train') || inputLower.includes('taxi') || inputLower.includes('przejazd')) {
    return 'Zbiór `train_cleaned.csv` zawiera 1,458,644 rekordów o przejazdach taxi w Nowym Jorku ze średnim czasem trwania trasy wynoszącym ok. 16 minut.';
  }

  return 'Dziękuję za wiadomość! Jestem gotowa pomóc Ci w analizie danych, nawigacji po portalu lub odpowiadać na dowolne pytania.';
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.innerText = text;
  return div.innerHTML;
}

function handleContactSubmit(event) {
  event.preventDefault();
  alert('Dziękujemy za przesłanie wiadomości! Skontaktujemy się z Tobą najszybciej jak to możliwe.');
  event.target.reset();
}

/* --- CHARTS INITIALIZATION --- */
function initCharts() {
  const hourlyCtx = document.getElementById('hourlyChart')?.getContext('2d');
  const passengerCtx = document.getElementById('passengerChart')?.getContext('2d');

  if (hourlyCtx) {
    new Chart(hourlyCtx, {
      type: 'line',
      data: {
        labels: ['00:00', '03:00', '06:00', '09:00', '12:00', '15:00', '18:00', '21:00'],
        datasets: [{
          label: 'Liczba Przejazdów',
          data: [42000, 21000, 35000, 89000, 105000, 118000, 142000, 98000],
          borderColor: '#6366f1',
          backgroundColor: 'rgba(99, 102, 241, 0.15)',
          fill: true,
          tension: 0.4,
          borderWidth: 3,
          pointBackgroundColor: '#a855f7'
        }]
      },
      options: {
        responsive: true,
        plugins: {
          legend: { labels: { color: '#9ca3af' } }
        },
        scales: {
          x: { ticks: { color: '#9ca3af' }, grid: { color: 'rgba(255, 255, 255, 0.05)' } },
          y: { ticks: { color: '#9ca3af' }, grid: { color: 'rgba(255, 255, 255, 0.05)' } }
        }
      }
    });
  }

  if (passengerCtx) {
    new Chart(passengerCtx, {
      type: 'doughnut',
      data: {
        labels: ['1 Pasażer', '2 Pasażerów', '3+ Pasażerów'],
        datasets: [{
          data: [71, 19, 10],
          backgroundColor: ['#6366f1', '#a855f7', '#06b6d4'],
          borderWidth: 0
        }]
      },
      options: {
        responsive: true,
        plugins: {
          legend: { position: 'bottom', labels: { color: '#9ca3af' } }
        }
      }
    });
  }

  // --- FINANCIAL CHARTS ---
  const financeCtx = document.getElementById('financeTrendChart')?.getContext('2d');
  const revenueCategoryCtx = document.getElementById('revenueCategoryChart')?.getContext('2d');

  if (financeCtx) {
    new Chart(financeCtx, {
      type: 'bar',
      data: {
        labels: ['Q1 2026', 'Q2 2026', 'Q3 2026', 'Q4 (Prognoza)'],
        datasets: [
          {
            label: 'Przychód (PLN)',
            data: [1120000, 1250000, 1380000, 1500000],
            backgroundColor: '#6366f1',
            borderRadius: 6
          },
          {
            label: 'Koszty (PLN)',
            data: [820000, 910000, 990000, 1050000],
            backgroundColor: 'rgba(239, 68, 68, 0.7)',
            borderRadius: 6
          },
          {
            label: 'Zysk Netto (PLN)',
            data: [300000, 340000, 390000, 450000],
            backgroundColor: '#10b981',
            borderRadius: 6
          }
        ]
      },
      options: {
        responsive: true,
        plugins: {
          legend: { labels: { color: '#9ca3af' } }
        },
        scales: {
          x: { ticks: { color: '#9ca3af' }, grid: { color: 'rgba(255, 255, 255, 0.05)' } },
          y: { ticks: { color: '#9ca3af' }, grid: { color: 'rgba(255, 255, 255, 0.05)' } }
        }
      }
    });
  }

  if (revenueCategoryCtx) {
    new Chart(revenueCategoryCtx, {
      type: 'pie',
      data: {
        labels: ['Produkty Premium', 'Abonamenty AI', 'Usługi Analityczne', 'Akcesoria'],
        datasets: [{
          data: [45, 25, 20, 10],
          backgroundColor: ['#6366f1', '#a855f7', '#06b6d4', '#10b981'],
          borderWidth: 0
        }]
      },
      options: {
        responsive: true,
        plugins: {
          legend: { position: 'bottom', labels: { color: '#9ca3af' } }
        }
      }
    });
  }
}
