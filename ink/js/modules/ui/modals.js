export function showToast(message, type = 'default', duration = 4000) {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = 'toast' + (type !== 'default' ? ' toast-' + type : '');
    toast.textContent = message;
    container.appendChild(toast);

    setTimeout(() => {
        toast.classList.add('toast-exit');
        setTimeout(() => toast.remove(), 250);
    }, duration);
}

export function showSimpleConfirm(message, { okLabel = 'OK', cancelLabel = 'キャンセル' } = {}) {
    return new Promise(resolve => {
        const modal = document.getElementById('confirm-modal');
        const msgEl = document.getElementById('confirm-message');
        const cancelBtn = document.getElementById('confirm-cancel-btn');
        const okBtn = document.getElementById('confirm-ok-btn');

        if (!modal || !msgEl || !cancelBtn || !okBtn) {
            resolve(window.confirm(message));
            return;
        }

        msgEl.textContent = message;

        const newCancel = cancelBtn.cloneNode(true);
        cancelBtn.parentNode.replaceChild(newCancel, cancelBtn);
        const newOk = okBtn.cloneNode(true);
        okBtn.parentNode.replaceChild(newOk, okBtn);

        newCancel.textContent = cancelLabel;
        newOk.textContent = okLabel;

        newCancel.addEventListener('click', () => { modal.classList.add('hidden'); resolve(false); });
        newOk.addEventListener('click', () => { modal.classList.add('hidden'); resolve(true); });

        modal.classList.remove('hidden');
    });
}

export function showResumeModal({ title, badge, thumbnailUrl, timestamp, okLabel, cancelLabel } = {}) {
    return new Promise(resolve => {
        const modal = document.getElementById('resume-modal');
        if (!modal) { resolve(false); return; }

        const thumbImg = document.getElementById('resume-thumbnail');
        const thumbEmpty = document.getElementById('resume-thumbnail-empty');
        const titleEl = document.getElementById('resume-title');
        const badgeEl = document.getElementById('resume-badge');
        const dateEl = document.getElementById('resume-date');
        const okBtn = document.getElementById('resume-ok-btn');
        const cancelBtn = document.getElementById('resume-cancel-btn');

        if (thumbnailUrl) {
            thumbImg.src = thumbnailUrl;
            thumbImg.style.display = 'block';
            thumbEmpty.style.display = 'none';
        } else {
            thumbImg.style.display = 'none';
            thumbEmpty.style.display = 'flex';
        }

        titleEl.textContent = title || '前回の続きがあります';

        if (badge) {
            badgeEl.textContent = badge;
            badgeEl.style.display = 'inline-block';
        } else {
            badgeEl.style.display = 'none';
        }

        if (timestamp) {
            const d = new Date(timestamp);
            dateEl.textContent = d.toLocaleString('ja-JP', {
                year: 'numeric', month: 'numeric', day: 'numeric',
                hour: '2-digit', minute: '2-digit'
            });
        } else {
            dateEl.textContent = '';
        }

        okBtn.textContent = okLabel || '再開する';
        cancelBtn.textContent = cancelLabel || '新規作成';

        const newOk = okBtn.cloneNode(true);
        okBtn.parentNode.replaceChild(newOk, okBtn);
        const newCancel = cancelBtn.cloneNode(true);
        cancelBtn.parentNode.replaceChild(newCancel, cancelBtn);

        newOk.addEventListener('click', () => {
            modal.classList.add('hidden');
            resolve(true);
        });
        newCancel.addEventListener('click', () => {
            modal.classList.add('hidden');
            resolve(false);
        });

        modal.classList.remove('hidden');
    });
}

