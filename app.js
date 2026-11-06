/* ---------- 1. BEFORE / AFTER SLIDER ---------- */
(function () {
  const wrap = document.getElementById('baWrap');
  const after = document.getElementById('baAfter');
  const handle = document.getElementById('baHandle');
  if (!wrap || !after || !handle) return;

  let active = false;

  function update(clientX) {
    const rect = wrap.getBoundingClientRect();
    let pct = ((clientX - rect.left) / rect.width) * 100;
    pct = Math.max(0, Math.min(100, pct));
    after.style.clipPath = `inset(0 ${100 - pct}% 0 0)`;
    handle.style.left = pct + '%';
  }

  wrap.addEventListener('mousedown', (e) => { active = true; update(e.clientX); });
  wrap.addEventListener('mousemove', (e) => { if (active) update(e.clientX); });
  window.addEventListener('mouseup', () => { active = false; });

  wrap.addEventListener('touchstart', (e) => { active = true; update(e.touches[0].clientX); }, { passive: true });
  wrap.addEventListener('touchmove', (e) => { if (active) update(e.touches[0].clientX); }, { passive: true });
  window.addEventListener('touchend', () => { active = false; });
})();

/* ---------- 2. LEAD FORM ---------- */
(function () {
  const form = document.getElementById('leadForm');
  const success = document.getElementById('formSuccess');
  if (!form || !success) return;

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    success.style.display = 'block';
    form.reset();
    success.scrollIntoView({ behavior: 'smooth', block: 'center' });
  });
})();

/* ---------- 3. SMOOTH ANCHOR SCROLL ---------- */
(function () {
  document.querySelectorAll('a[href^="#"]').forEach((a) => {
    a.addEventListener('click', function (e) {
      const id = this.getAttribute('href');
      if (id === '#' || id.length < 2) return;
      const target = document.querySelector(id);
      if (target) {
        e.preventDefault();
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    });
  });
})();

/* ---------- 4. LIVE AI DEMO (Teachable Machine) ---------- */
(function () {
  const drop = document.getElementById('aiDrop');
  const file = document.getElementById('aiFile');
  const preview = document.getElementById('aiPreview');
  const inner = document.getElementById('aiDropInner');
  const result = document.getElementById('aiResult');
  if (!drop || !file) return;

  const placeholder = result.querySelector('.ai-result-placeholder');
  const content = result.querySelector('.ai-result-content');
  const classesEl = document.getElementById('aiClasses');
  const timeEl = document.getElementById('aiTime');
  const loading = document.getElementById('aiLoading');

  let model = null;

  // Загружаем модель из папки "model"
  async function loadModel() {
    try {
      const modelURL = "./model/model.json";
      const metadataURL = "./model/metadata.json";
      model = await tmImage.load(modelURL, metadataURL);
      console.log("Нейросеть NeuroScan успешно загружена!");
    } catch (error) {
      console.error("Ошибка загрузки модели:", error);
      loading.textContent = "Ошибка: не удалось загрузить модель. Проверьте папку model.";
      loading.style.display = 'block';
      loading.style.color = '#ef4444';
    }
  }

  // Начинаем загрузку модели сразу при открытии сайта
  loadModel();

  drop.addEventListener('click', (e) => { if (e.target !== file) file.click(); });
  drop.addEventListener('dragover', (e) => { e.preventDefault(); drop.classList.add('drag'); });
  drop.addEventListener('dragleave', () => drop.classList.remove('drag'));
  drop.addEventListener('drop', (e) => {
    e.preventDefault(); drop.classList.remove('drag');
    if (e.dataTransfer.files[0]) handleFile(e.dataTransfer.files[0]);
  });
  file.addEventListener('change', (e) => {
    if (e.target.files[0]) handleFile(e.target.files[0]);
  });

  async function handleFile(f) {
    if (!f.type.startsWith('image/')) {
      alert('Пожалуйста, загрузите изображение (JPG, PNG).');
      return;
    }
    
    const url = URL.createObjectURL(f);
    preview.src = url; 
    preview.style.display = 'block';
    inner.style.display = 'none';
    placeholder.style.display = 'none'; 
    content.style.display = 'none';
    
    loading.style.display = 'block';
    loading.style.color = 'var(--cyan-dark)';
    loading.textContent = 'Нейросеть анализирует снимок...';

    if (!model) {
      loading.textContent = "Модель еще загружается, подождите пару секунд...";
      return;
    }

    preview.onload = async () => {
      try {
        const t0 = performance.now();
        
        // Запускаем предсказание
        const predictions = await model.predict(preview);
        
        const t1 = performance.now();
        timeEl.textContent = Math.round(t1 - t0) + ' мс';
        
        predictions.sort((a, b) => b.probability - a.probability);
        
        classesEl.innerHTML = predictions.map((p) => {
          const isPneumonia = p.className.toLowerCase().includes('пневмон') || p.className.toLowerCase().includes('pneumonia');
          const color = isPneumonia ? '#ef4444' : '#16a34a';
          
          return `
            <div class="ai-class">
              <div class="ai-class-name" style="color: ${color}; font-weight: bold;">${p.className}</div>
              <div class="ai-class-bar"><div class="ai-class-fill" style="width:${(p.probability * 100).toFixed(1)}%; background: ${color};"></div></div>
              <div class="ai-class-prob" style="color: ${color};">${(p.probability * 100).toFixed(1)}%</div>
            </div>
          `;
        }).join('');

        loading.style.display = 'none';
        content.style.display = 'block';
      } catch (err) {
        loading.textContent = "Ошибка при анализе.";
        loading.style.color = '#ef4444';
      }
    };
  }
})();