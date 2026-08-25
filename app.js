const DEFAULT_DATA = {
  folders: [{ id: "root", name: "Général", parentId: null }],
  questions: []
};

class App {
  constructor() {
    this.data = this.loadData();
    this.currentQuiz = null;
    this.globalTimer = null;
    this.questionTimer = null;
    this.initUI();
  }

  loadData() {
    const local = localStorage.getItem("qcm_app_data");
    return local ? JSON.parse(local) : DEFAULT_DATA;
  }

  saveData() {
    localStorage.setItem("qcm_app_data", JSON.stringify(this.data));
    this.renderDashboard();
  }

  initUI() {
    if (localStorage.getItem("dark_mode") === "true") {
      document.body.classList.add("dark-mode");
    }
    document.getElementById("theme-toggle").addEventListener("click", () => {
      document.body.classList.toggle("dark-mode");
      localStorage.setItem("dark_mode", document.body.classList.contains("dark-mode"));
    });

    document.querySelectorAll(".nav-btn").forEach(btn => {
      btn.addEventListener("click", () => this.showTab(btn.dataset.tab));
    });

    this.renderDashboard();
    this.initFormOptions();
  }

  showTab(tabId) {
    document.querySelectorAll(".tab-content").forEach(tab => tab.classList.remove("active"));
    document.querySelectorAll(".nav-btn").forEach(btn => btn.classList.remove("active"));
    
    document.getElementById(`tab-${tabId}`).classList.add("active");
    const activeNav = document.querySelector(`.nav-btn[data-tab="${tabId}"]`);
    if (activeNav) activeNav.classList.add("active");

    if (tabId === "create") this.updateFolderSelects();
    if (tabId === "stats") this.renderStats();
  }

  renderDashboard() {
    document.getElementById("total-cards-count").textContent = this.data.questions.length;
    
    let attempts = 0, success = 0;
    this.data.questions.forEach(q => {
      if (q.stats) { attempts += q.stats.attempts || 0; success += q.stats.success || 0; }
    });
    const rate = attempts > 0 ? Math.round((success / attempts) * 100) : 0;
    document.getElementById("global-success-rate").textContent = `${rate}%`;

    const container = document.getElementById("tree-container");
    container.innerHTML = "";
    this.renderFolderTree(null, container);
  }

  renderFolderTree(parentId, container) {
    const folders = this.data.folders.filter(f => f.parentId === parentId);
    
    folders.forEach(folder => {
      const folderQuestions = this.data.questions.filter(q => q.folderId === folder.id);
      const node = document.createElement("div");
      node.className = "tree-node";

      const folderRow = document.createElement("div");
      folderRow.className = "folder-row";
      
      const titleSpan = document.createElement("div");
      titleSpan.className = "folder-title";
      titleSpan.innerHTML = `<span>📂</span> <span>${folder.name}</span> <span class="folder-badge">${folderQuestions.length}</span>`;
      
      titleSpan.onclick = () => {
        const children = node.querySelector(".folder-children");
        if (children) children.classList.toggle("hidden");
      };

      const actionsDiv = document.createElement("div");
      actionsDiv.className = "folder-actions";
      
      if (folderQuestions.length > 0) {
        const playBtn = document.createElement("button");
        playBtn.className = "btn-sm btn-primary";
        playBtn.textContent = "▶️";
        playBtn.onclick = (e) => { e.stopPropagation(); this.startQuizSession(folderQuestions, folder.name); };
        actionsDiv.appendChild(playBtn);
      }

      const addBtn = document.createElement("button");
      addBtn.className = "btn-sm btn-secondary";
      addBtn.textContent = "+";
      addBtn.onclick = (e) => { e.stopPropagation(); this.promptCreateFolder(folder.id); };
      actionsDiv.appendChild(addBtn);

      if (folder.id !== "root") {
        const delBtn = document.createElement("button");
        delBtn.className = "btn-sm btn-danger";
        delBtn.textContent = "🗑️";
        delBtn.onclick = (e) => { e.stopPropagation(); this.deleteFolder(folder.id); };
        actionsDiv.appendChild(delBtn);
      }

      folderRow.appendChild(titleSpan);
      folderRow.appendChild(actionsDiv);
      node.appendChild(folderRow);

      const childrenDiv = document.createElement("div");
      childrenDiv.className = "folder-children";
      this.renderFolderTree(folder.id, childrenDiv);
      node.appendChild(childrenDiv);

      container.appendChild(node);
    });
  }

  promptCreateFolder(parentId = null) {
    const name = prompt("Nom du dossier :");
    if (name) {
      this.data.folders.push({ id: "f_" + Date.now(), name, parentId });
      this.saveData();
    }
  }

  deleteFolder(folderId) {
    if (confirm("Supprimer ce dossier ?")) {
      this.data.folders = this.data.folders.filter(f => f.id !== folderId);
      this.data.questions.forEach(q => { if (q.folderId === folderId) q.folderId = "root"; });
      this.saveData();
    }
  }

  initFormOptions() {
    const container = document.getElementById("options-builder");
    container.innerHTML = "";
    this.addOptionInput();
    this.addOptionInput();
  }

  addOptionInput() {
    const container = document.getElementById("options-builder");
    const div = document.createElement("div");
    div.className = "option-input-row";
    div.innerHTML = `
      <input type="checkbox" class="option-correct-check">
      <input type="text" placeholder="Option" class="option-text-input" required>
    `;
    container.appendChild(div);
  }

  updateFolderSelects() {
    const select = document.getElementById("create-folder-select");
    select.innerHTML = "";
    this.data.folders.forEach(f => {
      const opt = document.createElement("option");
      opt.value = f.id;
      opt.textContent = f.name;
      select.appendChild(opt);
    });
  }

  handleManualCreate(e) {
    e.preventDefault();
    const folderId = document.getElementById("create-folder-select").value;
    const questionText = document.getElementById("create-question").value;
    const explanationText = document.getElementById("create-explanation").value;

    const options = [];
    document.querySelectorAll(".option-input-row").forEach(row => {
      const text = row.querySelector(".option-text-input").value;
      const isCorrect = row.querySelector(".option-correct-check").checked;
      if (text) options.push({ text, isCorrect });
    });

    this.data.questions.push({
      id: "q_" + Date.now(),
      folderId,
      question: questionText,
      options,
      explanation: explanationText,
      starred: false,
      lastRevised: null,
      stats: { attempts: 0, success: 0 }
    });

    this.saveData();
    alert("QCM ajouté !");
    document.getElementById("create-qcm-form").reset();
    this.initFormOptions();
  }

  importFromText() {
    try {
      const json = JSON.parse(document.getElementById("import-text").value);
      this.processImport(json);
    } catch (err) { alert("Format JSON invalide."); }
  }

  importFromFile(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      try { this.processImport(JSON.parse(evt.target.result)); }
      catch (err) { alert("Fichier JSON invalide."); }
    };
    reader.readAsText(file);
  }

  processImport(json) {
    if (Array.isArray(json)) {
      json.forEach(q => {
        q.id = q.id || "q_" + Date.now() + Math.random();
        q.folderId = q.folderId || "root";
        q.stats = q.stats || { attempts: 0, success: 0 };
        this.data.questions.push(q);
      });
    } else if (json.questions) {
      if (json.folders) {
        json.folders.forEach(f => {
          if (!this.data.folders.find(ex => ex.id === f.id)) this.data.folders.push(f);
        });
      }
      json.questions.forEach(q => this.data.questions.push(q));
    }
    this.saveData();
    alert("QCM importés avec succès !");
    document.getElementById("import-text").value = "";
  }

  exportData(stripStats = false) {
    let exportObj = JSON.parse(JSON.stringify(this.data));
    if (stripStats) {
      exportObj.questions.forEach(q => { delete q.stats; delete q.lastRevised; delete q.starred; });
    }
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(exportObj, null, 2));
    const dlAnchor = document.createElement("a");
    dlAnchor.setAttribute("href", dataStr);
    dlAnchor.setAttribute("download", stripStats ? "qcm_partage.json" : "qcm_sauvegarde.json");
    dlAnchor.click();
    dlAnchor.remove();
  }

  startFilteredSession(type) {
    let list = [];
    const now = Date.now();
    const sevenDays = 7 * 24 * 60 * 60 * 1000;

    if (type === "errors") {
      list = this.data.questions.filter(q => q.stats && q.stats.attempts > 0 && (q.stats.success / q.stats.attempts) < 0.5);
    } else if (type === "spaced") {
      list = this.data.questions.filter(q => !q.lastRevised || (now - q.lastRevised) > sevenDays);
    } else if (type === "starred") {
      list = this.data.questions.filter(q => q.starred);
    }

    if (list.length === 0) {
      alert("Aucune question trouvée pour ce filtre.");
      return;
    }

    this.startQuizSession(list, `Révision : ${type}`);
  }

  startQuizSession(questionsList, title) {
    this.currentQuiz = {
      title,
      questions: questionsList,
      currentIndex: 0,
      userAnswers: {},
      startTime: Date.now(),
      questionStartTime: Date.now()
    };

    document.getElementById("quiz-title").textContent = title;
    document.getElementById("quiz-overlay").classList.remove("hidden");
    this.startTimers();
    this.renderQuizQuestion();
  }

  startTimers() {
    clearInterval(this.globalTimer);
    clearInterval(this.questionTimer);

    this.globalTimer = setInterval(() => {
      const elapsed = Math.floor((Date.now() - this.currentQuiz.startTime) / 1000);
      const m = String(Math.floor(elapsed / 60)).padStart(2, '0');
      const s = String(elapsed % 60).padStart(2, '0');
      document.getElementById("timer-global").textContent = `G: ${m}:${s}`;
    }, 1000);

    this.resetQuestionTimer();
  }

  resetQuestionTimer() {
    clearInterval(this.questionTimer);
    this.currentQuiz.questionStartTime = Date.now();
    const qTimerEl = document.getElementById("timer-question");
    qTimerEl.classList.remove("overtime");

    this.questionTimer = setInterval(() => {
      const elapsed = Math.floor((Date.now() - this.currentQuiz.questionStartTime) / 1000);
      if (elapsed <= 120) {
        const m = String(Math.floor(elapsed / 60)).padStart(2, '0');
        const s = String(elapsed % 60).padStart(2, '0');
        qTimerEl.textContent = `Q: ${m}:${s}`;
      } else {
        const overtime = elapsed - 120;
        const m = String(Math.floor(overtime / 60)).padStart(2, '0');
        const s = String(overtime % 60).padStart(2, '0');
        qTimerEl.textContent = `Q: +${m}:${s}`;
        qTimerEl.classList.add("overtime");
      }
    }, 1000);
  }

  renderQuizQuestion() {
    const q = this.currentQuiz.questions[this.currentQuiz.currentIndex];
    document.getElementById("quiz-progress").textContent = `${this.currentQuiz.currentIndex + 1}/${this.currentQuiz.questions.length}`;
    document.getElementById("quiz-question-text").textContent = q.question;
    
    document.getElementById("star-btn").classList.toggle("active", !!q.starred);

    const container = document.getElementById("quiz-options-container");
    container.innerHTML = "";
    
    const selectedIndices = this.currentQuiz.userAnswers[this.currentQuiz.currentIndex] || [];

    q.options.forEach((opt, idx) => {
      const btn = document.createElement("button");
      btn.className = "option-btn" + (selectedIndices.includes(idx) ? " selected" : "");
      btn.textContent = opt.text;
      btn.onclick = () => this.toggleOptionSelect(idx);
      container.appendChild(btn);
    });

    document.getElementById("quiz-explanation").classList.add("hidden");
    document.getElementById("btn-validate-q").classList.remove("hidden");
    document.getElementById("btn-next-q").classList.add("hidden");

    this.resetQuestionTimer();
    this.renderExamGrid();
  }

  toggleOptionSelect(idx) {
    let currentSel = this.currentQuiz.userAnswers[this.currentQuiz.currentIndex] || [];
    if (currentSel.includes(idx)) {
      currentSel = currentSel.filter(i => i !== idx);
    } else {
      currentSel.push(idx);
    }
    this.currentQuiz.userAnswers[this.currentQuiz.currentIndex] = currentSel;
    this.renderQuizQuestion();
  }

  toggleCurrentStar() {
    const q = this.currentQuiz.questions[this.currentQuiz.currentIndex];
    q.starred = !q.starred;
    this.saveData();
    document.getElementById("star-btn").classList.toggle("active", q.starred);
  }

  validateQuestion() {
    const q = this.currentQuiz.questions[this.currentQuiz.currentIndex];
    const userSel = this.currentQuiz.userAnswers[this.currentQuiz.currentIndex] || [];

    q.stats = q.stats || { attempts: 0, success: 0 };
    q.stats.attempts++;
    q.lastRevised = Date.now();

    const correctIndices = q.options.map((opt, i) => opt.isCorrect ? i : null).filter(i => i !== null);
    const isSuccess = JSON.stringify(userSel.sort()) === JSON.stringify(correctIndices.sort());

    if (isSuccess) q.stats.success++;

    const optionBtns = document.querySelectorAll(".option-btn");
    q.options.forEach((opt, idx) => {
      if (opt.isCorrect) optionBtns[idx].classList.add("correct");
      if (userSel.includes(idx) && !opt.isCorrect) optionBtns[idx].classList.add("wrong");
    });

    if (q.explanation) {
      document.getElementById("quiz-explanation-text").textContent = q.explanation;
      document.getElementById("quiz-explanation").classList.remove("hidden");
    }

    document.getElementById("btn-validate-q").classList.add("hidden");
    document.getElementById("btn-next-q").classList.remove("hidden");
    this.saveData();
  }

  nextQuestion() {
    if (this.currentQuiz.currentIndex < this.currentQuiz.questions.length - 1) {
      this.currentQuiz.currentIndex++;
      this.renderQuizQuestion();
    } else {
      alert("Session terminée ! Bravo !");
      this.quitQuiz();
    }
  }

  prevQuestion() {
    if (this.currentQuiz.currentIndex > 0) {
      this.currentQuiz.currentIndex--;
      this.renderQuizQuestion();
    }
  }

  skipQuestion() {
    this.nextQuestion();
  }

  toggleExamGrid() {
    document.getElementById("exam-grid-container").classList.toggle("hidden");
  }

  renderExamGrid() {
    const grid = document.getElementById("exam-grid-container");
    grid.innerHTML = "";
    this.currentQuiz.questions.forEach((_, idx) => {
      const cell = document.createElement("div");
      cell.className = "grid-cell";
      if (idx === this.currentQuiz.currentIndex) cell.classList.add("current");
      if (this.currentQuiz.userAnswers[idx] && this.currentQuiz.userAnswers[idx].length > 0) {
        cell.classList.add("answered");
      }
      cell.textContent = idx + 1;
      cell.onclick = () => {
        this.currentQuiz.currentIndex = idx;
        this.renderQuizQuestion();
      };
      grid.appendChild(cell);
    });
  }

  quitQuiz() {
    clearInterval(this.globalTimer);
    clearInterval(this.questionTimer);
    document.getElementById("quiz-overlay").classList.add("hidden");
  }

  renderStats() {
    const container = document.getElementById("stats-details-list");
    container.innerHTML = "";

    this.data.questions.forEach(q => {
      const attempts = q.stats ? q.stats.attempts : 0;
      const success = q.stats ? q.stats.success : 0;
      const rate = attempts > 0 ? Math.round((success / attempts) * 100) : 0;

      const div = document.createElement("div");
      div.className = "folder-row";
      div.style.marginBottom = "6px";
      div.innerHTML = `
        <div><strong>${q.question.substring(0, 35)}...</strong></div>
        <div><span class="folder-badge">${rate}% (${success}/${attempts})</span></div>
      `;
      container.appendChild(div);
    });
  }
}

const app = new App();
