// Base de données par défaut + chargement local
let db_folders = [
    { id: "f_ana", name: "Anatomie", parent: null },
    { id: "f_bio", name: "Biochimie", parent: null },
    { id: "f_osteo", name: "Ostéologie", parent: "f_ana" } // Sous-dossier exemple
];

let db_qcm = [];
let sessionQuestions = [];
let indexActuel = 0;
let qcmActuel;
let timerInterval;
let tempsEcoule = 0;
let modeActuel = 'training';
let estValide = false;
let editingQcmId = null;

// Initialisation
document.addEventListener('DOMContentLoaded', () => {
    chargerDonneesLocales();
    initialiserNavigationTabs();
    rafraichirTousLesSelects();
    afficherArborescence();
});

function chargerDonneesLocales() {
    const customFolders = localStorage.getItem('p1_folders');
    const customQcm = localStorage.getItem('p1_qcm');

    if (customFolders) db_folders = JSON.parse(customFolders);
    if (customQcm) {
        db_qcm = JSON.parse(customQcm);
    } else {
        // Charger le fichier JSON de base si vide
        fetch('qcm.json')
            .then(res => res.json())
            .then(data => {
                db_qcm = data;
                sauvegarderTout();
                afficherArborescence();
            })
            .catch(err => console.log("Pas de qcm.json trouvé."));
    }
}

function sauvegarderTout() {
    localStorage.setItem('p1_folders', JSON.stringify(db_folders));
    localStorage.setItem('p1_qcm', JSON.stringify(db_qcm));
    rafraichirTousLesSelects();
    afficherArborescence();
}

// NAVIGATION TAB BAR
function initialiserNavigationTabs() {
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
            document.querySelectorAll('.tab-content').forEach(c => c.classList.add('hidden'));

            btn.classList.add('active');
            const target = btn.dataset.tab;
            document.getElementById(target).classList.remove('hidden');
        });
    });

    document.querySelectorAll('.theme-toggle').forEach(btn => {
        btn.addEventListener('click', () => document.body.classList.toggle('dark-theme'));
    });
}

// GENERATION DES DOSSIERS / SOUS-DOSSIERS
function rafraichirTousLesSelects() {
    const selects = ['home-folder-select', 'add-folder-target', 'edit-folder-select'];
    
    selects.forEach(selectId => {
        const select = document.getElementById(selectId);
        if(!select) return;
        select.innerHTML = '';

        if(selectId === 'home-folder-select') {
            select.innerHTML = '<option value="all">Toutes les matières (Mélange général)</option>';
        }

        db_folders.filter(f => f.parent === null).forEach(parent => {
            const opt = document.createElement('option');
            opt.value = parent.id;
            opt.textContent = parent.name;
            select.appendChild(opt);

            // Sous-dossiers
            db_folders.filter(f => f.parent === parent.id).forEach(sub => {
                const subOpt = document.createElement('option');
                subOpt.value = sub.id;
                subOpt.textContent = `└─ ${sub.name}`;
                select.appendChild(subOpt);
            });
        });
    });
}

// CREER UN DOSSIER / SOUS-DOSSIER
document.getElementById('add-folder-btn').addEventListener('click', () => {
    const nom = prompt("Nom du dossier :");
    if (!nom) return;
    
    const isSub = confirm("Est-ce un sous-dossier ? (Annuler = Dossier principal)");
    let parentId = null;

    if (isSub) {
        const parents = db_folders.filter(f => f.parent === null);
        const choix = prompt("Numéro du dossier parent :\n" + parents.map((p, i) => `${i + 1}. ${p.name}`).join('\n'));
        if (choix && parents[choix - 1]) parentId = parents[choix - 1].id;
    }

    const newFolder = { id: 'f_' + Date.now(), name: nom, parent: parentId };
    db_folders.push(newFolder);
    sauvegarderTout();
});

// SAISIE RAPIDE DE QCM
document.getElementById('save-bulk-btn').addEventListener('click', () => {
    const text = document.getElementById('bulk-input').value.trim();
    const folderId = document.getElementById('add-folder-target').value;

    if (!text) return;

    const lines = text.split('\n');
    let ajouts = 0;

    lines.forEach((line, i) => {
        const p = line.split(';').map(x => x.trim());
        if (p.length >= 7) {
            db_qcm.push({
                id: Date.now() + i,
                folderId: folderId,
                question: p[0],
                items: [
                    { lettre: "A", texte: p[1] },
                    { lettre: "B", texte: p[2] },
                    { lettre: "C", texte: p[3] },
                    { lettre: "D", texte: p[4] },
                    { lettre: "E", texte: p[5] }
                ],
                reponses: p[6].toUpperCase().split(',').map(r => r.trim())
            });
            ajouts++;
        }
    });

    if (ajouts > 0) {
        sauvegarderTout();
        document.getElementById('bulk-input').value = '';
        alert(`${ajouts} QCM ajoutés !`);
    } else {
        alert("Erreur de format. Respectez : Question ; A ; B ; C ; D ; E ; Réponses");
    }
});

// AFFICHER LA BIBLIOTHÈQUE ET PERMETTRE L'ÉDITION / SUPPRESSION
function afficherArborescence() {
    const container = document.getElementById('folders-tree-container');
    container.innerHTML = '';

    const parents = db_folders.filter(f => f.parent === null);

    parents.forEach(p => {
        const pDiv = document.createElement('div');
        pDiv.className = 'folder-item card';
        pDiv.innerHTML = `<div class="folder-header"><span>📁 ${p.name}</span></div>`;

        // QCM directement sous le parent
        imprimerQCMList(pDiv, p.id);

        // Sous-dossiers
        const subs = db_folders.filter(f => f.parent === p.id);
        subs.forEach(s => {
            const sDiv = document.createElement('div');
            sDiv.className = 'subfolder-item';
            sDiv.innerHTML = `<div class="subfolder-header">└─ 📂 ${s.name}</div>`;
            imprimerQCMList(sDiv, s.id);
            pDiv.appendChild(sDiv);
        });

        container.appendChild(pDiv);
    });
}

function imprimerQCMList(parentEl, folderId) {
    const qcms = db_qcm.filter(q => q.folderId === folderId);
    qcms.forEach(q => {
        const row = document.createElement('div');
        row.className = 'qcm-row';
        row.innerHTML = `
            <span>${q.question.substring(0, 35)}...</span>
            <div class="qcm-actions">
                <span class="action-text" onclick="ouvrirEdition(${q.id})">Modifier</span>
                <span class="action-delete" onclick="supprimerQCM(${q.id})">✕</span>
            </div>
        `;
        parentEl.appendChild(row);
    });
}

// SUPPRIMER ET MODIFIER
window.supprimerQCM = function(id) {
    if (confirm("Supprimer ce QCM ?")) {
        db_qcm = db_qcm.filter(q => q.id !== id);
        sauvegarderTout();
    }
};

window.ouvrirEdition = function(id) {
    const q = db_qcm.find(item => item.id === id);
    if (!q) return;

    editingQcmId = id;
    document.getElementById('edit-q-text').value = q.question;
    document.getElementById('edit-folder-select').value = q.folderId || '';
    document.getElementById('edit-item-a').value = q.items[0]?.texte || '';
    document.getElementById('edit-item-b').value = q.items[1]?.texte || '';
    document.getElementById('edit-item-c').value = q.items[2]?.texte || '';
    document.getElementById('edit-item-d').value = q.items[3]?.texte || '';
    document.getElementById('edit-item-e').value = q.items[4]?.texte || '';
    document.getElementById('edit-answers').value = q.reponses.join(',');

    document.getElementById('edit-modal').classList.remove('hidden');
};

document.getElementById('close-modal-btn').addEventListener('click', () => {
    document.getElementById('edit-modal').classList.add('hidden');
});

document.getElementById('save-edit-btn').addEventListener('click', () => {
    const q = db_qcm.find(item => item.id === editingQcmId);
    if (q) {
        q.question = document.getElementById('edit-q-text').value;
        q.folderId = document.getElementById('edit-folder-select').value;
        q.items[0].texte = document.getElementById('edit-item-a').value;
        q.items[1].texte = document.getElementById('edit-item-b').value;
        q.items[2].texte = document.getElementById('edit-item-c').value;
        q.items[3].texte = document.getElementById('edit-item-d').value;
        q.items[4].texte = document.getElementById('edit-item-e').value;
        q.reponses = document.getElementById('edit-answers').value.toUpperCase().split(',').map(x => x.trim());

        sauvegarderTout();
        document.getElementById('edit-modal').classList.add('hidden');
    }
});

// LANCER LE QUIZ
document.getElementById('start-btn').addEventListener('click', () => {
    const folderId = document.getElementById('home-folder-select').value;
    modeActuel = document.getElementById('mode-select').value;

    if (folderId === 'all') {
        sessionQuestions = [...db_qcm];
    } else {
        // Inclure le dossier + ses sous-dossiers
        const subIds = db_folders.filter(f => f.parent === folderId).map(f => f.id);
        const targetIds = [folderId, ...subIds];
        sessionQuestions = db_qcm.filter(q => targetIds.includes(q.folderId));
    }

    if (sessionQuestions.length === 0) {
        alert("Aucun QCM dans cette sélection !");
        return;
    }

    sessionQuestions.sort(() => Math.random() - 0.5);
    indexActuel = 0;

    document.getElementById('main-tab-bar').classList.add('hidden');
    document.querySelectorAll('.tab-content').forEach(c => c.classList.add('hidden'));
    document.getElementById('quiz-screen').classList.remove('hidden');

    chargerQuestion();
    demarrerChrono();
});

document.getElementById('back-home-btn').addEventListener('click', () => {
    arreterChrono();
    document.getElementById('quiz-screen').classList.add('hidden');
    document.getElementById('main-tab-bar').classList.remove('hidden');
    document.getElementById('tab-home').classList.remove('hidden');
});

function chargerQuestion() {
    estValide = false;
    qcmActuel = sessionQuestions[indexActuel];

    document.getElementById('quiz-title').textContent = "Entraînement";
    document.getElementById('question-subtitle').textContent = `Question ${indexActuel + 1} sur ${sessionQuestions.length}`;

    const pourcent = Math.round(((indexActuel + 1) / sessionQuestions.length) * 100);
    document.getElementById('progress-fill').style.width = `${pourcent}%`;
    document.getElementById('progress-percentage').textContent = `${pourcent}%`;

    document.getElementById('question-text').textContent = qcmActuel.question;

    const container = document.getElementById('items-container');
    container.innerHTML = '';

    qcmActuel.items.forEach(item => {
        const div = document.createElement('div');
        div.className = 'item';
        div.innerHTML = `<span class="item-letter">${item.lettre}</span><span>${item.texte}</span>`;
        div.dataset.lettre = item.lettre;

        div.addEventListener('click', () => {
            if (!estValide) div.classList.toggle('selected');
        });

        container.appendChild(div);
    });

    document.getElementById('action-btn').textContent = "VALIDER LA RÉPONSE";
}

document.getElementById('action-btn').addEventListener('click', () => {
    if (!estValide) {
        estValide = true;
        const itemsDivs = document.querySelectorAll('.item');
        let erreurs = 0;

        itemsDivs.forEach(div => {
            const lettre = div.dataset.lettre;
            const estCoche = div.classList.contains('selected');
            const estVrai = qcmActuel.reponses.includes(lettre);

            if (modeActuel === 'training') {
                if (estCoche && estVrai) div.classList.add('correct');
                else if (estCoche && !estVrai) div.classList.add('incorrect');
                else if (!estCoche && estVrai) div.classList.add('missed');
            }

            if (estCoche !== estVrai) erreurs++;
        });

        document.getElementById('action-btn').textContent = indexActuel < sessionQuestions.length - 1 ? "QUESTION SUIVANTE ›" : "TERMINER LA SESSION";
    } else {
        if (indexActuel < sessionQuestions.length - 1) {
            indexActuel++;
            chargerQuestion();
        } else {
            arreterChrono();
            alert("Session terminée !");
            document.getElementById('back-home-btn').click();
        }
    }
});

// CHRONO & EXPORT / IMPORT
function demarrerChrono() {
    tempsEcoule = 0;
    clearInterval(timerInterval);
    timerInterval = setInterval(() => {
        tempsEcoule++;
        let m = Math.floor(tempsEcoule / 60).toString().padStart(2, '0');
        let s = (tempsEcoule % 60).toString().padStart(2, '0');
        document.getElementById('chrono').textContent = `${m}:${s}`;
    }, 1000);
}
function arreterChrono() { clearInterval(timerInterval); }

document.getElementById('export-btn').addEventListener('click', () => {
    const data = { folders: db_folders, qcm: db_qcm };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `p1_qcm_export_${Date.now()}.json`;
    a.click();
});

document.getElementById('import-file-input').addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
        try {
            const imported = JSON.parse(event.target.result);
            if (imported.folders && imported.qcm) {
                db_folders = imported.folders;
                db_qcm = imported.qcm;
                sauvegarderTout();
                alert("Importation réussie !");
            }
        } catch(err) { alert("Fichier invalide."); }
    };
    reader.readAsText(file);
});

document.getElementById('reset-stats-btn').addEventListener('click', () => {
    if (confirm("Réinitialiser l'historique ?")) {
        localStorage.removeItem('p1_stats');
        alert("Historique réinitialisé.");
    }
});
