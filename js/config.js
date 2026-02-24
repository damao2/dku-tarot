/* DKU Tarot - API Configuration */
const Config = (() => {
  const PREFIX = 'dku_tarot_';

  const DEFAULTS = {
    apiUrl: 'https://api.openai.com/v1/chat/completions',
    apiKey: '',
    model: 'gpt-4o-mini',
  };

  function get(key) {
    return localStorage.getItem(PREFIX + key) || DEFAULTS[key] || '';
  }

  function set(key, value) {
    localStorage.setItem(PREFIX + key, value);
  }

  function getAll() {
    return {
      apiUrl: get('apiUrl'),
      apiKey: get('apiKey'),
      model: get('model'),
    };
  }

  function hasApiKey() {
    return get('apiKey').trim().length > 0;
  }

  // Settings modal logic
  function initModal() {
    const overlay = document.getElementById('config-modal-overlay');
    if (!overlay) return;

    const form = overlay.querySelector('.config-modal');
    const inputUrl = form.querySelector('#config-api-url');
    const inputKey = form.querySelector('#config-api-key');
    const inputModel = form.querySelector('#config-model');
    const btnSave = form.querySelector('.btn-save');
    const btnCancel = form.querySelector('.btn-cancel');

    function openModal() {
      const config = getAll();
      inputUrl.value = config.apiUrl;
      inputKey.value = config.apiKey;
      inputModel.value = config.model;
      overlay.classList.add('open');
    }

    function closeModal() {
      overlay.classList.remove('open');
    }

    function saveConfig() {
      set('apiUrl', inputUrl.value.trim());
      set('apiKey', inputKey.value.trim());
      set('model', inputModel.value.trim());
      closeModal();
    }

    btnSave.addEventListener('click', saveConfig);
    btnCancel.addEventListener('click', closeModal);
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) closeModal();
    });

    // Bind all settings buttons
    document.querySelectorAll('[data-open-settings]').forEach((btn) => {
      btn.addEventListener('click', openModal);
    });
  }

  return { get, set, getAll, hasApiKey, initModal };
})();
