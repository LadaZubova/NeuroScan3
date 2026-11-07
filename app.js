/* ============================================================
   NeuroScan — клиентская логика
   1. Переключение вкладок (Teachable Machine / YOLO)
   2. Отправка лид-формы
   3. Плавный скролл
   4. Teachable Machine (классификация)
   5. YOLO через Roboflow API (детекция с рамками)
   ============================================================ */

/* ---------- 1. ПЕРЕКЛЮЧЕНИЕ ВКЛАДОК ---------- */
// Функция должна быть глобальной (window), так как вызывается через onclick в HTML
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

  // Загружаем вашу модель Teachable Machine
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

/* ---------- 5. YOLO (Детектор с рамками через Roboflow) ---------- */
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

  // =====================================================================
  // ⚠️ ВАЖНО: ВСТАВЬТЕ ВАШ API КЛЮЧ ИЗ ROBOFLOW НИЖЕ
  // =====================================================================
  const ROBOFLOW_API_KEY = "ВСТАВЬТЕ_ВАШ_КЛЮЧ_СЮДА"; 
  
  // ID модели из Roboflow (из вашего скриншота)
  const MODEL_ID = "pneumonia-detection-rmztw/2";

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
    inner.style.display = 'none';
    placeholder.style.display = 'none';
    content.style.display = 'none';
    loading.style.display = 'block';
    loading.textContent = "Отправляем снимок на сервер YOLO...";

    const url = `https://detect.roboflow.com/${MODEL_ID}?api_key=${ROBOFLOW_API_KEY}`;
    
    // Roboflow ожидает картинку в формате Base64
    const reader = new FileReader();
    reader.readAsDataURL(imageFile);
    reader.onload = async () => {
      const base64data = reader.result.split(',')[1];
      const t0 = performance.now();

      try {
        const response = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: base64data
        });
        
        const data = await response.json();
        
        if (data.predictions) {
          preview.src = reader.result; 
          
          // Ждем загрузки картинки, чтобы правильно нарисовать холст
          preview.onload = () => {
            preview.style.display = 'block';
            drawBoxes(preview, canvas, data.predictions);
            
            if (data.predictions.length > 0) {
              textRes.innerHTML = `<span style="color:#ef4444; font-weight:bold;">Обнаружена пневмония!</span><br>Найдено зон: ${data.predictions.length}`;
            } else {
              textRes.innerHTML = `<span style="color:#4ade80; font-weight:bold;">Патологий не обнаружено (Норма).</span>`;
            }
            
            timeEl.textContent = Math.round(performance.now() - t0) + ' мс';
            loading.style.display = 'none';
            content.style.display = 'block';
          };
        } else {
          throw new Error("Неверный формат ответа от Roboflow");
        }
      } catch (err) {
        loading.textContent = "Ошибка запроса к Roboflow. Проверьте API-ключ.";
        loading.style.color = "#ef4444";
        console.error(err);
      }
    };
  }

  // Функция отрисовки красных рамок на холсте
  function drawBoxes(img, canvas, predictions) {
    const w = img.clientWidth;
    const h = img.clientHeight;
    canvas.width = w;
    canvas.height = h;
    
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, w, h);

    // Масштабируем координаты, если картинка сжата CSS
    const scaleX = w / img.naturalWidth;
    const scaleY = h / img.naturalHeight;

    predictions.forEach(pred => {
      // Roboflow дает координаты центра и размеры
      const x = (pred.x - pred.width / 2) * scaleX;
      const y = (pred.y - pred.height / 2) * scaleY;
      const boxW = pred.width * scaleX;
      const boxH = pred.height * scaleY;

      // Рисуем красную рамку
      ctx.strokeStyle = '#ef4444'; 
      ctx.lineWidth = 3;
      ctx.strokeRect(x, y, boxW, boxH);

      // Рисуем фон для текста (черный полупрозрачный)
      ctx.fillStyle = 'rgba(239, 68, 68, 0.8)';
      ctx.fillRect(x, y - 25, 130, 25);

      // Пишем текст
      ctx.fillStyle = '#ffffff';
      ctx.font = '14px Inter, sans-serif';
      ctx.fillText(`Пневмония: ${Math.round(pred.confidence * 100)}%`, x + 5, y - 7);
    });
  }
})();
