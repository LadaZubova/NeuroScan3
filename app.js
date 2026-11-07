/* ============================================================
   NeuroScan — клиентская логика
   1. Переключение вкладок (Teachable Machine / YOLO)
   2. Отправка лид-формы
   3. Плавный скролл
   4. Teachable Machine (классификация)
   5. YOLO через Roboflow API (детекция с рамками)
   ============================================================ */

/* ---------- 1. ПЕРЕКЛЮЧЕНИЕ ВКЛАДОК ---------- */
window.switchTab = function (tab) {
  const btnTm = document.getElementById('btn-tm');
  const btnYolo = document.getElementById('btn-yolo');
  const tabTm = document.getElementById('tab-tm');
  const tabYolo = document.getElementById('tab-yolo');

  if (!btnTm || !btnYolo) return;

  if (tab === 'tm') {
    btnTm.className = 'btn btn-pill btn-primary';
    btnYolo.className = 'btn btn-pill btn-glass';
    tabTm.style.display = 'block';
    tabYolo.style.display = 'none';
  } else {
    btnTm.className = 'btn btn-pill btn-glass';
    btnYolo.className = 'btn btn-pill btn-primary';
    tabTm.style.display = 'none';
    tabYolo.style.display = 'block';
  }
};

/* ---------- 2. ОТПРАВКА ФОРМЫ ---------- */
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

/* ---------- 3. ПЛАВНЫЙ СКРОЛЛ ---------- */
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

/* ---------- 4. TEACHABLE MACHINE (Классификатор) ---------- */
(function () {
  const drop = document.getElementById('aiDrop');
  const file = document.getElementById('aiFile');
  const preview = document.getElementById('aiPreview');
  const inner = document.getElementById('aiDropInner');
  const result = document.getElementById('aiResult');
  const loading = document.getElementById('aiLoading');
  
  if (!drop || !file) return;

  const placeholder = result.querySelector('.ai-result-placeholder');
  const content = result.querySelector('.ai-result-content');
  const classesEl = document.getElementById('aiClasses');
  const timeEl = document.getElementById('aiTime');

  let model = null;

  async function loadModel() {
    try {
      const modelURL = "./model/model.json";
      const metadataURL = "./model/metadata.json";
      model = await tmImage.load(modelURL, metadataURL);
      console.log("Нейросеть Teachable Machine загружена!");
    } catch (error) {
      console.error("Ошибка загрузки TM модели:", error);
      loading.textContent = "Ошибка: не удалось загрузить модель. Проверьте папку model.";
      loading.style.display = 'block';
      loading.style.color = '#ef4444';
    }
  }
  loadModel();

  drop.addEventListener('click', () => file.click());
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
    if (!f.type.startsWith('image/')) return alert('Загрузите картинку (JPG, PNG).');
    
    const url = URL.createObjectURL(f);
    preview.src = url; 
    preview.style.display = 'block';
    inner.style.display = 'none';
    placeholder.style.display = 'none'; 
    content.style.display = 'none';
    loading.style.display = 'block';
    loading.textContent = 'Нейросеть анализирует снимок...';

    if (!model) {
      loading.textContent = "Модель еще загружается, подождите...";
      return;
    }

    preview.onload = async () => {
      try {
        const t0 = performance.now();
        const predictions = await model.predict(preview);
        const t1 = performance.now();
        
        timeEl.textContent = Math.round(t1 - t0) + ' мс';
        predictions.sort((a, b) => b.probability - a.probability);
        
        classesEl.innerHTML = predictions.map((p) => {
          const isPneumonia = p.className.toLowerCase().includes('пневмон') || p.className.toLowerCase().includes('pneumonia');
          const color = isPneumonia ? '#ef4444' : '#4ade80';
          
          return `
            <div class="ai-class" style="margin-bottom: 12px;">
              <div class="ai-class-name" style="color: ${color}; font-weight: bold;">${p.className}</div>
              <div class="ai-class-bar" style="height: 8px; background: rgba(255,255,255,0.1); border-radius: 4px;">
                <div class="ai-class-fill" style="width:${(p.probability * 100).toFixed(1)}%; background: ${color}; height: 100%; border-radius: 4px;"></div>
              </div>
              <div class="ai-class-prob" style="color: ${color}; text-align: right; font-size: 13px;">${(p.probability * 100).toFixed(1)}%</div>
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

/* ---------- 5. YOLO (Детектор с рамками через Roboflow SDK) ---------- */
(function() {
  const drop = document.getElementById('yoloDrop');
  const file = document.getElementById('yoloFile');
  const preview = document.getElementById('yoloPreview');
  const inner = document.getElementById('yoloDropInner');
  const placeholder = document.getElementById('yoloPlaceholder');
  const content = document.getElementById('yoloContent');
  const textRes = document.getElementById('yoloText');
  const loading = document.getElementById('yoloLoading');
  const timeEl = document.getElementById('yoloTime');
  const canvas = document.getElementById('yoloCanvas'); 

  if (!drop || !file) return;

  // ⚠️ ВСТАВЬ СЮДА СВОЙ ПУБЛИЧНЫЙ КЛЮЧ (который начинается на rf_)
  const ROBOFLOW_PUBLISHABLE_KEY = "ВСТАВЬТЕ_ВАШ_PUBLISHABLE_KEY"; 
  
  let model = null;

  // Инициализируем модель Roboflow через их SDK
  async function initRoboflow() {
    try {
      const rf = Roboflow.inject({ publishable_key: ROBOFLOW_PUBLISHABLE_KEY });
      model = await rf.load({ 
        model: "pneumonia-detection-rmztw", 
        version: 2 
      });
      console.log("Модель YOLO (Roboflow) успешно загружена!");
    } catch (err) {
      console.error("Ошибка загрузки YOLO:", err);
    }
  }
  initRoboflow();

  drop.addEventListener('click', () => file.click());
  drop.addEventListener('dragover', (e) => { e.preventDefault(); drop.classList.add('drag'); });
  drop.addEventListener('dragleave', () => drop.classList.remove('drag'));
  drop.addEventListener('drop', (e) => {
    e.preventDefault(); drop.classList.remove('drag');
    if (e.dataTransfer.files[0]) uploadImage(e.dataTransfer.files[0]);
  });
  file.addEventListener('change', (e) => {
    if (e.target.files[0]) uploadImage(e.target.files[0]);
  });

  async function uploadImage(imageFile) {
    if (!model) return alert("Модель YOLO еще загружается, подождите пару секунд...");

    inner.style.display = 'none';
    placeholder.style.display = 'none';
    content.style.display = 'none';
    loading.style.display = 'block';
    loading.textContent = "YOLO анализирует снимок...";

    // Показываем картинку
    const imgUrl = URL.createObjectURL(imageFile);
    preview.src = imgUrl;
    preview.style.display = 'block';

    // Ждем загрузки картинки в DOM, чтобы знать её размеры
    preview.onload = async () => {
      try {
        const t0 = performance.now();
        
        // Официальный SDK сам делает все запросы и обходит CORS
        const predictions = await model.detect(preview);
        
        const t1 = performance.now();
        timeEl.textContent = Math.round(t1 - t0) + ' мс';

        // Очищаем холст
        canvas.width = preview.clientWidth;
        canvas.height = preview.clientHeight;
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        if (predictions.length > 0) {
          textRes.innerHTML = `<span style="color:#ef4444; font-weight:bold;">Обнаружена пневмония!</span><br>Найдено зон: ${predictions.length}`;
          
          // Рисуем рамки
          predictions.forEach(pred => {
            const x = pred.bbox.x;
            const y = pred.bbox.y;
            const w = pred.bbox.width;
            const h = pred.bbox.height;

            ctx.strokeStyle = '#ef4444'; 
            ctx.lineWidth = 3;
            ctx.strokeRect(x, y, w, h);

            ctx.fillStyle = 'rgba(239, 68, 68, 0.8)';
            ctx.fillRect(x, y - 25, 140, 25);

            ctx.fillStyle = '#ffffff';
            ctx.font = '14px Inter, sans-serif';
            ctx.fillText(`Пневмония: ${Math.round(pred.confidence * 100)}%`, x + 5, y - 7);
          });
        } else {
          textRes.innerHTML = `<span style="color:#4ade80; font-weight:bold;">Патологий не обнаружено (Норма).</span>`;
        }

        loading.style.display = 'none';
        content.style.display = 'block';

      } catch (err) {
        console.error("Ошибка при анализе:", err);
        loading.textContent = "Ошибка при анализе снимка.";
        loading.style.color = "#ef4444";
      }
    };
  }
})();
