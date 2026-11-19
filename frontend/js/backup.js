/**
 * TASMAC SHOP NO. 11066 – ANNADURAI M
 * Database Backup and Restore Manager
 * 100% Offline, exports full IndexedDB state to portable JSON file & restores safely
 */

const BackupManager = {
  init() {
    this.bindEvents();
  },

  bindEvents() {
    const exportBtn = document.getElementById('backup-btn-export');
    if (exportBtn) {
      exportBtn.addEventListener('click', () => this.exportBackup());
    }

    const restoreInput = document.getElementById('backup-file-input');
    if (restoreInput) {
      restoreInput.addEventListener('change', (e) => this.handleFileRestore(e));
    }

    const resetBtn = document.getElementById('backup-btn-reset');
    if (resetBtn) {
      resetBtn.addEventListener('click', () => this.resetDatabase());
    }

    const testBtn = document.getElementById('btn-run-self-test');
    if (testBtn) {
      testBtn.addEventListener('click', () => this.runDiagnostics());
    }
  },

  async runDiagnostics() {
    const box = document.getElementById('self-test-results-box');
    const testBtn = document.getElementById('btn-run-self-test');
    if (!box) return;

    box.style.display = 'block';
    box.innerHTML = `<div style="padding: 10px; font-weight: bold; color: var(--primary);">⏳ Executing automated self-test scenarios...</div>`;
    if (testBtn) testBtn.disabled = true;

    await DiagnosticTests.runAllTests((results) => {
      box.innerHTML = `
        <div style="font-weight: 800; font-size: 14px; margin-bottom: 8px; color: var(--primary-dark);">
          AUTOMATED TEST SUITE EXECUTION LOG:
        </div>
        <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
          ${results
            .map(
              (r) => `
            <tr style="border-bottom: 1px solid #eee;">
              <td style="padding: 6px; font-weight: 700;">${r.name}</td>
              <td style="padding: 6px; text-align: center;">
                <span style="display: inline-block; padding: 2px 8px; border-radius: 4px; font-weight: 800; font-size: 11px; color: #fff; background: ${
                  r.status === 'PASSED' ? '#27ae60' : r.status === 'FAILED' ? '#c0392b' : '#f39c12'
                };">
                  ${r.status}
                </span>
              </td>
              <td style="padding: 6px; color: #555; font-size: 12px;">${r.details}</td>
            </tr>`
            )
            .join('')}
        </table>
      `;
    });

    if (testBtn) testBtn.disabled = false;
    App.showToast('Automated self-diagnostic tests completed!', 'success');
  },

  async exportBackup() {
    try {
      const backupData = await window.tasmacDB.exportBackupJSON();
      const jsonStr = JSON.stringify(backupData, null, 2);
      const blob = new Blob([jsonStr], { type: 'application/json' });
      const filename = `tasmac_shop11066_backup_${new Date().toISOString().replace(/[:.]/g, '-')}.json`;

      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      App.showToast('Database backup downloaded successfully!', 'success');
    } catch (err) {
      console.error(err);
      App.showToast('Failed to export backup: ' + err.message, 'error');
    }
  },

  async handleFileRestore(event) {
    const file = event.target.files[0];
    if (!file) return;

    const ok = confirm(
      'WARNING: Restoring from a backup file will replace the current records on this device.\n' +
      'Do you want to proceed with restore?'
    );
    if (!ok) {
      event.target.value = '';
      return;
    }

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const jsonData = JSON.parse(e.target.result);
        if (!jsonData.shop_number || jsonData.shop_number !== '11066') {
          const proceed = confirm('Notice: This backup does not specify Shop 11066. Restore anyway?');
          if (!proceed) return;
        }

        await window.tasmacDB.restoreBackupJSON(jsonData);
        App.showToast('Database restored successfully from backup!', 'success');
        setTimeout(() => {
          window.location.reload();
        }, 800);
      } catch (err) {
        console.error(err);
        App.showToast('Restore failed: Invalid JSON backup file.', 'error');
      }
    };
    reader.readAsText(file);
  },

  async resetDatabase() {
    const confirm1 = confirm('CAUTION: Are you sure you want to completely clear all saved records on this device?');
    if (!confirm1) return;

    const confirm2 = prompt('Type RESET in capital letters to confirm:');
    if (confirm2 !== 'RESET') {
      App.showToast('Reset cancelled.', 'info');
      return;
    }

    try {
      await window.tasmacDB.resetDatabase();
      App.showToast('All device database records have been reset.', 'success');
      setTimeout(() => {
        window.location.reload();
      }, 800);
    } catch (err) {
      App.showToast('Reset failed: ' + err.message, 'error');
    }
  },
};

window.BackupManager = BackupManager;

