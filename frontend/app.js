(function () {
  const API_BASE = window.location.origin;
  let currentUser = 'user_001';

  function uuid() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/x/g, function () {
      return (Math.random() * 16 | 0).toString(16);
    });
  }

  function getAssetKey(assetCode) {
    const map = { GOLD_COINS: 'gold', DIAMONDS: 'diamond', LOYALTY_POINTS: 'points' };
    return map[assetCode] || 'gold';
  }

  function showMessage(elId, text, isError) {
    const el = document.getElementById(elId);
    if (!el) return;
    el.textContent = text;
    el.className = 'message show ' + (isError ? 'error' : 'success');
    el.style.display = 'block';
    setTimeout(function () { el.classList.remove('show'); el.style.display = 'none'; }, 5000);
  }

  async function fetchBalance() {
    try {
      const res = await fetch(API_BASE + '/wallet/balance/' + currentUser);
      const data = await res.json();
      if (!res.ok) {
        document.getElementById('bal-gold').textContent = '-';
        document.getElementById('bal-diamond').textContent = '-';
        document.getElementById('bal-points').textContent = '-';
        return;
      }
      const balances = data.balances || [];
      const byCode = {};
      balances.forEach(function (b) { byCode[b.assetCode] = b.balance; });
      document.getElementById('bal-gold').textContent = byCode.GOLD_COINS ?? '-';
      document.getElementById('bal-diamond').textContent = byCode.DIAMONDS ?? '-';
      document.getElementById('bal-points').textContent = byCode.LOYALTY_POINTS ?? '-';
    } catch (err) {
      document.getElementById('bal-gold').textContent = 'err';
      document.getElementById('bal-diamond').textContent = 'err';
      document.getElementById('bal-points').textContent = 'err';
    }
  }

  function submitForm(formId, endpoint, msgId, getBody) {
    const form = document.getElementById(formId);
    const btn = form.querySelector('button[type="submit"]');
    const msgEl = document.getElementById(msgId);

    form.addEventListener('submit', async function (e) {
      e.preventDefault();
      btn.disabled = true;
      form.classList.add('loading');
      msgEl.className = 'message';
      msgEl.style.display = 'none';

      const idempotencyKey = uuid();
      const body = getBody(form);

      try {
        const res = await fetch(API_BASE + endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Idempotency-Key': idempotencyKey
          },
          body: JSON.stringify(body)
        });
        const data = await res.json();

        if (res.ok) {
          showMessage(msgId, 'Success! New balance: ' + data.newBalance + ' | Tx: ' + data.transactionId, false);
          fetchBalance();
        } else {
          showMessage(msgId, (data.error || 'Request failed'), true);
        }
      } catch (err) {
        showMessage(msgId, 'Network error: ' + err.message, true);
      } finally {
        btn.disabled = false;
        form.classList.remove('loading');
      }
    });
  }

  document.querySelectorAll('.user-select button').forEach(function (btn) {
    btn.addEventListener('click', function () {
      document.querySelector('.user-select button.active').classList.remove('active');
      btn.classList.add('active');
      currentUser = btn.dataset.user;
      fetchBalance();
    });
  });

  submitForm('form-topup', '/wallet/topup', 'msg-topup', function (form) {
    const fd = new FormData(form);
    const o = {
      userId: currentUser,
      assetCode: fd.get('assetCode'),
      amount: parseInt(fd.get('amount'), 10)
    };
    const pr = fd.get('paymentRef');
    if (pr) o.paymentRef = pr;
    return o;
  });

  submitForm('form-bonus', '/wallet/bonus', 'msg-bonus', function (form) {
    const fd = new FormData(form);
    const o = {
      userId: currentUser,
      assetCode: fd.get('assetCode'),
      amount: parseInt(fd.get('amount'), 10)
    };
    const r = fd.get('reason');
    if (r) o.reason = r;
    return o;
  });

  submitForm('form-spend', '/wallet/spend', 'msg-spend', function (form) {
    const fd = new FormData(form);
    const o = {
      userId: currentUser,
      assetCode: fd.get('assetCode'),
      amount: parseInt(fd.get('amount'), 10)
    };
    const d = fd.get('description');
    if (d) o.description = d;
    return o;
  });

  fetchBalance();
})();
