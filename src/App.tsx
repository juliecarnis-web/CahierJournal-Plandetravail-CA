import React, { useState, useEffect, useMemo } from 'react';
import { 
  Calendar, 
  Trash2, 
  Plus, 
  Share2, 
  Settings, 
  ChevronLeft, 
  ChevronRight, 
  Clock, 
  GraduationCap, 
  Copy,
  Lock,
  Eye,
  LogOut,
  Upload,
  ExternalLink,
  ChevronDown,
  Info
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  format, 
  addDays, 
  subDays, 
  isSameDay, 
  parseISO, 
  isWithinInterval, 
  isBefore, 
  isAfter,
  startOfDay
} from 'date-fns';
import { fr } from 'date-fns/locale';
import LZString from 'lz-string';
import { cn } from '@/src/lib/utils';
import { TeacherData, ViewMode, LevelData, Reminder, DayRuleType } from '@/src/types';
import { ALGORITHM_MAP, DEFAULT_PERIODS } from '@/src/constants';

const TEACHER_PASSWORD = "HPF";

const INITIAL_DATA: TeacherData = {
  levels: [
    { 
      name: 'Exemple CE1', 
      notions: [
        { text: 'La multiplication', url: 'https://exemple.fr/maths1' },
        { text: 'Le passé composé', url: 'https://exemple.fr/français1' }
      ] 
    }
  ],
  periods: DEFAULT_PERIODS,
  reminders: [
    { id: '1', text: 'Ramasser les cahiers de poésie', completed: true },
    { id: '2', text: 'Préparer la sortie scolaire', completed: false }
  ],
  delay: 0,
};

export default function App() {
  const [data, setData] = useState<TeacherData>(INITIAL_DATA);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<ViewMode>('student');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [passwordInput, setPasswordInput] = useState('');
  const [showConfig, setShowConfig] = useState(false);
  const [copyStatus, setCopyStatus] = useState<string | null>(null);
  
  // Settings state
  const [csvInput, setCsvInput] = useState('');
  const [newReminder, setNewReminder] = useState('');
  const [homeworkInput, setHomeworkInput] = useState(data.homeworkUrl || '');

  // Load configuration from URL or LocalStorage
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const config = params.get('config');
    const forcedMode = params.get('mode') as ViewMode;

    const savedData = localStorage.getItem('pro_journal_config');
    
    if (config) {
      try {
        const decoded = LZString.decompressFromEncodedURIComponent(config);
        if (decoded) {
          const parsed = JSON.parse(decoded);
          setData(parsed);
          setHomeworkInput(parsed.homeworkUrl || '');
          localStorage.setItem('pro_journal_config', decoded);
        }
      } catch (e) {
        alert("Erreur lors du décodage du lien de partage.");
      }
    } else if (savedData) {
      try {
        const parsed = JSON.parse(savedData);
        setData(parsed);
        setHomeworkInput(parsed.homeworkUrl || '');
      } catch (e) {
        console.error("LocalStorage error", e);
      }
    }

    if (forcedMode) {
      if (forcedMode === 'teacher') {
        // We still need password to enter teacher mode even if URL says so
        setViewMode('student');
      } else {
        setViewMode(forcedMode);
      }
    }
  }, []);

  // Persist data changes
  useEffect(() => {
    localStorage.setItem('pro_journal_config', JSON.stringify(data));
  }, [data]);

  const handleTeacherAccess = () => {
    if (passwordInput === TEACHER_PASSWORD) {
      setIsAuthenticated(true);
      setViewMode('teacher');
      setPasswordInput('');
    } else {
      alert("Mot de passe incorrect (HPF attendu)");
    }
  };

  const calculateDayNumber = (targetDate: Date): number => {
    let dayCount = 0;
    const sortedPeriods = [...data.periods].sort((a, b) => isBefore(parseISO(a.start), parseISO(b.start)) ? -1 : 1);
    const target = startOfDay(targetDate);

    for (const period of sortedPeriods) {
      const pStart = startOfDay(parseISO(period.start));
      const pEnd = startOfDay(parseISO(period.end));

      if (isBefore(target, pStart)) break;

      const workDays = period.workDays || [1, 2, 4, 5];
      let current = new Date(pStart);
      
      while (!isAfter(current, pEnd) && !isAfter(current, target)) {
        if (workDays.includes(current.getDay())) {
          dayCount++;
        }
        current = addDays(current, 1);
      }

      if (!isAfter(target, pEnd)) break;
    }

    return dayCount;
  };

  const dayNumber = useMemo(() => calculateDayNumber(currentDate), [currentDate, data.periods]);
  const jourUtile = useMemo(() => dayNumber - (data.delay || 0), [dayNumber, data.delay]);
  const currentRule = ALGORITHM_MAP[jourUtile] || 'Blanc';

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (content) {
        setCsvInput(content);
        processCSV(content);
      }
    };
    reader.readAsText(file);
  };

  const processCSV = (content: string) => {
    try {
      // Robust split for different OS line endings
      const rows = content.trim().split(/\r?\n/).map(row => row.split(';').map(cell => cell.trim()));
      if (rows.length < 1) throw new Error("Fichier vide");

      const headers = rows[0];
      const newLevels: LevelData[] = [];

      for (let i = 0; i < headers.length; i += 2) {
        const levelName = headers[i];
        if (levelName) {
          const notions: { text: string; url: string }[] = [];
          for (let j = 1; j < rows.length; j++) {
            const row = rows[j];
            // Push even if empty to preserve index/day correspondence
            notions.push({
              text: (row && row[i]) || '',
              url: (row && row[i+1]) || ''
            });
          }
          newLevels.push({ name: levelName, notions });
        }
      }

      if (newLevels.length === 0) throw new Error("Aucun niveau détecté");

      setData(prev => ({ ...prev, levels: newLevels }));
      setCsvInput('');
      alert("Importation réussie ! Vos niveaux ont été mis à jour.");
    } catch (e: any) {
      alert(`Erreur d'importation : ${e.message}. Vérifiez que le séparateur utilisé est bien le point-virgule ';'`);
    }
  };

  const handleExportCSV = () => {
    let csvContent = "";
    // Headers
    csvContent += data.levels.map(l => `${l.name}; `).join(';') + "\n";
    
    // Max rows
    const maxRows = Math.max(...data.levels.map(l => l.notions.length));
    
    for (let i = 0; i < maxRows; i++) {
      csvContent += data.levels.map(l => {
        const notion = l.notions[i];
        return notion ? `${notion.text};${notion.url}` : ";";
      }).join(';') + "\n";
    }

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", "journal_classe_config.csv");
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleImportCSV = () => {
    if (!csvInput.trim()) return;
    processCSV(csvInput);
  };

  const handleAddReminder = () => {
    if (!newReminder.trim()) return;
    const reminder: Reminder = {
      id: Math.random().toString(36).substr(2, 9),
      text: newReminder,
      completed: false
    };
    setData(prev => ({ ...prev, reminders: [reminder, ...prev.reminders] }));
    setNewReminder('');
  };

  const toggleReminder = (id: string) => {
    setData(prev => ({
      ...prev,
      reminders: prev.reminders.map(r => r.id === id ? { ...r, completed: !r.completed } : r)
    }));
  };

  const removeReminder = (id: string) => {
    setData(prev => ({ ...prev, reminders: prev.reminders.filter(r => r.id !== id) }));
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopyStatus(id);
    setTimeout(() => setCopyStatus(null), 2000);
  };

  const generateShareLink = (forStudent = false) => {
    const configStr = JSON.stringify(data);
    const compressed = LZString.compressToEncodedURIComponent(configStr);
    
    if (compressed.length > 2000) {
      alert("Le volume de données est important. Si le lien ne fonctionne pas, réduisez la taille du CSV.");
    }

    const url = new URL(window.location.origin + window.location.pathname);
    url.searchParams.set('config', compressed);
    url.searchParams.set('mode', forStudent ? 'student' : 'teacher');
    return url.toString();
  };

  // Use a helper to determine if current date is a working day
  const isWorkingDay = useMemo(() => {
    const currentPeriod = data.periods.find(p => 
      isWithinInterval(currentDate, { start: parseISO(p.start), end: parseISO(p.end) })
    );
    return currentPeriod ? (currentPeriod.workDays || [1, 2, 4, 5]).includes(currentDate.getDay()) : false;
  }, [currentDate, data.periods]);

  const handleClearData = () => {
    if (confirm("VOULEZ-VOUS VRAIMENT TOUT EFFACER ? Cette action est irréversible et supprimera tous les niveaux, notions et rappels.")) {
      setData(INITIAL_DATA);
      localStorage.removeItem('pro_journal_config');
      alert("Données réinitialisées.");
    }
  };

  const handleUpdateHomework = () => {
    setData(prev => ({ ...prev, homeworkUrl: homeworkInput }));
    alert("Lien des devoirs mis à jour !");
  };

  const handleEditNotion = (levelIdx: number, notionIdx: number, field: 'text' | 'url', value: string) => {
    const newLevels = [...data.levels];
    newLevels[levelIdx].notions[notionIdx][field] = value;
    setData({ ...data, levels: newLevels });
  };

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900 w-full overflow-x-hidden flex flex-col">
      {/* Header - Full Width */}
      <header className="bg-white border-b border-slate-200 px-4 py-4 md:px-8">
        <div className="w-full flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-indigo-600 rounded-2xl flex items-center justify-center shadow-lg shadow-indigo-100">
              <GraduationCap className="w-7 h-7 text-white" />
            </div>
            <div>
              <h1 className="text-xl md:text-2xl font-black tracking-tight flex items-center gap-2">
                Cahier journal & Plan de travail
              </h1>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest leading-none">
                Classe Adaptative • {isAuthenticated ? "Mode Enseignant" : "Espace Élève"}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="text-right mr-4 border-r border-slate-100 pr-4 hidden md:block">
              <div className="text-[10px] font-black text-indigo-600 uppercase tracking-widest">{format(currentDate, 'EEEE', { locale: fr })}</div>
              <div className="text-lg font-bold">{format(currentDate, 'd MMMM yyyy', { locale: fr })}</div>
            </div>
            
            {isAuthenticated ? (
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2 bg-slate-100 px-3 py-2 rounded-xl border border-slate-200">
                  <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Retard</span>
                  <input 
                    type="number" 
                    value={data.delay}
                    onChange={(e) => setData({ ...data, delay: parseInt(e.target.value) || 0 })}
                    className="w-12 bg-transparent font-black text-indigo-600 focus:outline-none"
                    min="0"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <button 
                    onClick={() => setShowConfig(!showConfig)}
                    className="p-2.5 bg-slate-100 text-slate-600 hover:bg-indigo-600 hover:text-white rounded-xl transition-all shadow-sm"
                  >
                    <Settings className="w-5 h-5" />
                  </button>
                  <button 
                    onClick={() => setIsAuthenticated(false)}
                    className="flex items-center gap-2 px-4 py-2 bg-rose-50 text-rose-600 font-black text-xs uppercase tracking-widest rounded-xl hover:bg-rose-100 transition-colors border border-rose-200"
                  >
                    <LogOut className="w-4 h-4" />
                    Quitter
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-2 bg-white border border-slate-200 p-1 rounded-xl shadow-sm">
                <input 
                  type="password" 
                  placeholder="Mot de passe" 
                  value={passwordInput}
                  onChange={(e) => setPasswordInput(e.target.value)}
                  className="w-24 px-2 py-1 text-xs font-bold outline-none"
                  onKeyDown={(e) => e.key === 'Enter' && handleTeacherAccess()}
                />
                <button 
                  onClick={handleTeacherAccess}
                  className="p-1 text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                >
                  <Lock className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Main Content - No restrictive max-width except for alignment */}
      <main className="flex-grow p-4 md:p-8 flex flex-col gap-6">

        {/* TOP ROW: Reminders & Homework */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full">
            {/* Reminder Section */}
            <div className="bg-amber-100 rounded-[2.5rem] border border-amber-200 p-8 shadow-inner relative overflow-hidden">
              <div className="absolute top-0 right-0 p-4 opacity-10">
                <Clock className="w-20 h-20 text-amber-900" />
              </div>
              
              <h2 className="text-2xl font-black text-amber-900 mb-6 flex items-center gap-3">
                À ne pas oublier
              </h2>

              <div className="space-y-4 relative z-10">
                {isAuthenticated && (
                  <div className="flex gap-2">
                    <input 
                      type="text" 
                      placeholder="Nouvelle tâche..."
                      value={newReminder}
                      onChange={(e) => setNewReminder(e.target.value)}
                      className="bg-white/50 border border-amber-200 rounded-xl px-3 py-2 text-sm outline-none w-full focus:bg-white transition-all font-medium"
                      onKeyDown={(e) => e.key === 'Enter' && handleAddReminder()}
                    />
                    <button 
                      onClick={handleAddReminder}
                      className="p-2 bg-amber-900 text-white rounded-xl hover:scale-105 active:scale-95 transition-all"
                    >
                      <Plus className="w-5 h-5" />
                    </button>
                  </div>
                )}

                <div className={cn("overflow-y-auto pr-2 custom-scrollbar", data.reminders.length > 5 ? "h-[200px]" : "h-auto")}>
                  {data.reminders.map((reminder) => (
                    <motion.div 
                      key={reminder.id}
                      layout
                      className="flex items-center gap-3 py-2 border-b border-amber-900/10 group"
                    >
                      <button 
                        onClick={() => toggleReminder(reminder.id)}
                        className={cn(
                          "w-5 h-5 rounded flex items-center justify-center transition-all border-2",
                          reminder.completed ? "bg-amber-900 border-amber-900" : "border-amber-900/30 hover:border-amber-900"
                        )}
                      >
                        {reminder.completed && <Check className="w-3 h-3 text-white" />}
                      </button>
                      <span className={cn(
                        "text-sm font-bold flex-grow transition-all",
                        reminder.completed ? "text-amber-900/40 line-through" : "text-amber-900"
                      )}>
                        {reminder.text}
                      </span>
                      {isAuthenticated && (
                        <button 
                          onClick={() => removeReminder(reminder.id)}
                          className="opacity-0 group-hover:opacity-100 p-1 text-rose-600 hover:bg-rose-50 rounded"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </motion.div>
                  ))}
                </div>
                
                {data.reminders.length === 0 && (
                  <p className="text-center text-xs font-bold text-amber-900/30 italic py-4">Tout est sous contrôle !</p>
                )}
              </div>
            </div>

            {/* Homework Link */}
            {data.homeworkUrl ? (
              <div className="bg-indigo-600 rounded-[2.5rem] p-8 shadow-xl relative overflow-hidden flex flex-col justify-between items-start">
                <div className="absolute top-0 right-0 p-4 opacity-10">
                  <ExternalLink className="w-32 h-32 text-indigo-200" />
                </div>
                <div className="relative z-10">
                  <h2 className="text-2xl font-black text-white mb-2">Devoirs du jour</h2>
                  <p className="text-indigo-200 text-xs font-bold uppercase tracking-widest">Consultez la liste des devoirs</p>
                </div>
                <a 
                  href={data.homeworkUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-6 px-8 py-4 bg-white text-indigo-600 rounded-2xl font-black text-xs uppercase tracking-widest hover:scale-105 transition-all shadow-lg shadow-indigo-900/20 flex items-center gap-2 relative z-10"
                >
                  <Eye className="w-4 h-4" />
                  Ouvrir les devoirs
                </a>
              </div>
            ) : (
              <div className="bg-slate-100 rounded-[2.5rem] p-8 border border-slate-200 flex flex-col items-center justify-center text-center">
                <div className="p-4 bg-white rounded-2xl shadow-sm mb-4">
                  <Info className="w-8 h-8 text-slate-300" />
                </div>
                <p className="text-sm font-bold text-slate-400 italic">Aucun lien de devoirs configuré.</p>
                {isAuthenticated && <p className="text-[10px] text-slate-400 uppercase tracking-widest mt-2">Configurez-le dans les réglages</p>}
              </div>
            )}
        </div>
        
        {/* Navigation - Teacher Only */}
        {isAuthenticated && (
          <div className="w-full bg-white rounded-3xl border border-slate-200 p-4 flex flex-col md:flex-row items-center justify-between gap-4 shadow-sm">
            <div className="flex items-center gap-2">
              <button 
                onClick={() => setCurrentDate(subDays(currentDate, 1))}
                className="p-3 bg-slate-50 hover:bg-slate-100 text-slate-600 rounded-2xl transition-all active:scale-90"
                title="Jour précédent"
              >
                <ChevronLeft className="w-6 h-6" />
              </button>
              
              <div className="flex items-center gap-2 bg-slate-100 p-1.5 rounded-2xl border border-slate-200">
                <button 
                  onClick={() => setCurrentDate(new Date())}
                  className="px-4 py-2 font-black text-[10px] uppercase tracking-widest bg-white text-indigo-600 rounded-xl shadow-sm hover:bg-indigo-50 transition-all"
                >
                  Aujourd'hui
                </button>
                <input 
                  type="date" 
                  value={format(currentDate, 'yyyy-MM-dd')}
                  onChange={(e) => {
                    const d = parseISO(e.target.value);
                    if (!isNaN(d.getTime())) setCurrentDate(d);
                  }}
                  className="bg-transparent text-xs font-bold px-2 py-1 outline-none text-slate-600 cursor-pointer"
                />
              </div>

              <button 
                onClick={() => setCurrentDate(addDays(currentDate, 1))}
                className="p-3 bg-slate-50 hover:bg-slate-100 text-slate-600 rounded-2xl transition-all active:scale-90"
                title="Jour suivant"
              >
                <ChevronRight className="w-6 h-6" />
              </button>
            </div>

            <div className="flex items-center gap-6">
              <div className="text-center md:text-left">
                <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Jour Utile</div>
                <div className="text-2xl font-black text-slate-900 leading-none">
                  {isWorkingDay ? (jourUtile < 1 ? "Début de progression" : `J${jourUtile}`) : "Congés / Week-end"}
                </div>
              </div>
              

            </div>
          </div>
        )}

        <div className="grid grid-cols-1 xl:grid-cols-12 gap-8 items-start">
          
          {/* MATINÉE - The big dynamic grid */}
          <div className="xl:col-span-12 space-y-6">
            <div className="bg-white rounded-[2rem] border border-slate-200 p-6 md:p-10 shadow-sm min-h-[600px] flex flex-col">
              <div className="flex justify-between items-center mb-10">
                <h2 className="text-3xl font-black tracking-tight text-slate-900 flex items-center gap-4">
                  <span className="w-3 h-10 bg-indigo-600 rounded-full shadow-lg shadow-indigo-200"></span>
                  Matinée
                </h2>
                {!isWorkingDay && (
                  <div className="px-4 py-2 bg-slate-100 rounded-2xl text-slate-400 font-black text-xs uppercase tracking-widest">
                    Pas de classe
                  </div>
                )}
              </div>

              {isWorkingDay && jourUtile >= 1 ? (
                <div className={cn(
                  "grid gap-8 auto-rows-max flex-grow",
                  data.levels.length === 1 ? "grid-cols-1" : 
                  data.levels.length === 2 ? "grid-cols-2" : 
                  "grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
                )}>
                  {data.levels.map((level, levelIdx) => {
                    // Find all active notions for this level at the current JU
                    const activeNotions = level.notions
                      .map((notion, idx) => {
                        const age = jourUtile - idx;
                        const rule = ALGORITHM_MAP[age];
                        return { notion, age, rule, originalIdx: idx };
                      })
                      .filter(item => item.age >= 1 && item.rule && item.rule !== 'Blanc' && item.rule !== 'Rien');

                    // MODALITY GROUPING
                    const groups = [
                      { id: 'eval', name: 'Évaluations', rulePrefix: 'EVALUATION', bg: 'bg-[#FFD9D9]', border: 'border-[#FFBABA]', text: 'text-rose-900', items: [] as typeof activeNotions },
                      { id: 'mod', name: 'Modelage', rulePrefix: 'Modelage', bg: 'bg-[#FFF9C4]', border: 'border-[#FDD835]/30', text: 'text-amber-900', items: [] as typeof activeNotions },
                      { id: 'lec', name: 'Leçon', rulePrefix: 'Leçon', bg: 'bg-[#E3F2FD]', border: 'border-[#90CAF9]', text: 'text-blue-900', items: [] as typeof activeNotions },
                      { id: 'com', name: 'Tâche complexe', rulePrefix: 'Tache complexe', bg: 'bg-[#F8D7DA]', border: 'border-[#F1B0B7]', text: 'text-[#721C24]', items: [] as typeof activeNotions },
                      { id: 'ent', name: 'Entrainements', rulePrefix: 'Entrainement', bg: 'bg-[#F3E5F5]', border: 'border-[#CE93D8]', text: 'text-[#4A148C]', items: [] as typeof activeNotions },
                    ];

                    activeNotions.forEach(item => {
                      const group = groups.find(g => item.rule?.startsWith(g.rulePrefix));
                      if (group) group.items.push(item);
                    });

                    // Sub-grouping for Entrainements
                    const entGroup = groups.find(g => g.id === 'ent');
                    const entSubGroups = entGroup ? [
                      { id: 'cod', name: 'En cours de codage', keyword: 'Codage', bg: 'bg-[#FDF4FF]', border: 'border-purple-200', text: 'text-purple-700', items: entGroup.items.filter(it => it.rule?.includes('Codage')) },
                      { id: 'aut', name: "En cours d'automatisation", keyword: 'Automatisation', bg: 'bg-[#F5D0FE]', border: 'border-purple-300', text: 'text-purple-900', items: entGroup.items.filter(it => it.rule?.includes('Automatisation')) },
                      { id: 'rem', name: 'En cours de remémoration', keyword: 'Remémoration', bg: 'bg-[#D946EF]', border: 'border-purple-400', text: 'text-white', items: entGroup.items.filter(it => it.rule?.includes('Remémoration')) },
                    ].filter(sg => sg.items.length > 0) : [];
                    
                    return (
                      <div key={levelIdx} className="flex flex-col gap-6">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 bg-slate-900 rounded-xl flex items-center justify-center text-white font-black text-[10px]">
                            {levelIdx + 1}
                          </div>
                          <h3 className="font-black text-sm uppercase tracking-widest text-slate-500">
                            {level.name}
                          </h3>
                        </div>

                        <div className="space-y-6">
                          {groups.some(g => g.items.length > 0) ? (
                            groups.filter(g => g.items.length > 0).map((group) => {
                              const isEnt = group.id === 'ent';
                              return (
                                <motion.div 
                                  key={`${levelIdx}-${group.id}`}
                                  initial={{ opacity: 0, y: 10 }}
                                  animate={{ opacity: 1, y: 0 }}
                                  className={cn(
                                    "p-5 rounded-[2rem] border shadow-sm transition-all relative group",
                                    group.bg, group.border, group.text
                                  )}
                                >
                                  {/* Group Header & Copy */}
                                  <div className="flex justify-between items-start mb-4">
                                    <div className="text-[10px] font-black uppercase tracking-widest opacity-60">
                                      {group.name}
                                    </div>
                                    <button 
                                      onClick={() => {
                                        const textToCopy = group.items.map(it => `[${it.rule}] ${it.notion.text} (${it.notion.url})`).join('\n');
                                        copyToClipboard(textToCopy, `copy-group-${levelIdx}-${group.id}`);
                                      }}
                                      className="p-2 bg-white/50 shadow-sm rounded-xl text-slate-400 hover:text-indigo-600 transition-all active:scale-90"
                                      title="Copier tout le bloc"
                                    >
                                      {copyStatus === `copy-group-${levelIdx}-${group.id}` ? <CheckCircle className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
                                    </button>
                                  </div>

                                  {/* List of notions in this group */}
                                  <div className="space-y-4">
                                    {isEnt ? (
                                      entSubGroups.map(sg => (
                                        <div key={sg.id} className={cn("p-4 rounded-2xl space-y-3 border", sg.bg, sg.border)}>
                                          <div className={cn("text-[9px] font-black uppercase tracking-widest opacity-60", sg.text)}>
                                            {sg.name}
                                          </div>
                                          {sg.items.map((item, itemIdx) => (
                                            <div key={itemIdx} className="flex flex-col gap-1 border-t border-black/5 pt-3 first:border-0 first:pt-0">
                                              <div className="flex items-center justify-between">
                                                <div className={cn("text-[9px] font-black opacity-50", sg.text)}>{item.rule}</div>
                                                <div className={cn("text-[10px] font-bold opacity-30 italic", sg.text)}>J{item.age}</div>
                                              </div>
                                              <div className="flex items-start justify-between gap-4">
                                                <div className="flex flex-col gap-1 flex-grow">
                                                  {isAuthenticated && (
                                                    <div className="text-[8px] font-black opacity-30 uppercase tracking-tighter">
                                                      Source: CSV Ligne {item.originalIdx + 2} | Age: J{item.age}
                                                    </div>
                                                  )}
                                                  {isAuthenticated ? (
                                                    <input 
                                                      type="text" 
                                                      value={item.notion.text}
                                                      onChange={(e) => handleEditNotion(levelIdx, item.originalIdx, 'text', e.target.value)}
                                                      className="text-sm font-black bg-transparent border-b border-black/10 focus:border-black/30 outline-none w-full"
                                                    />
                                                  ) : (
                                                    <h4 className="text-sm font-black leading-snug">{item.notion.text}</h4>
                                                  )}
                                                  {item.notion.url && (
                                                    <a 
                                                      href={item.notion.url} 
                                                      target="_blank" 
                                                      rel="noopener noreferrer"
                                                      className={cn("flex items-center gap-1.5 text-[10px] font-bold hover:underline opacity-70", sg.text)}
                                                    >
                                                      Ressource <ExternalLink className="w-2.5 h-2.5" />
                                                    </a>
                                                  )}
                                                </div>
                                                
                                                {isAuthenticated && (
                                                  <button 
                                                    onClick={() => {
                                                      const newLevels = [...data.levels];
                                                      // Stable delete: keep index, clear content
                                                      newLevels[levelIdx].notions[item.originalIdx].text = "";
                                                      newLevels[levelIdx].notions[item.originalIdx].url = "";
                                                      setData({ ...data, levels: newLevels });
                                                    }}
                                                    className="p-1.5 text-rose-600 hover:bg-rose-100 rounded-lg transition-all"
                                                  >
                                                    <Trash2 className="w-3.5 h-3.5" />
                                                  </button>
                                                )}
                                              </div>
                                            </div>
                                          ))}
                                        </div>
                                      ))
                                    ) : (
                                      group.items.map((item, itemIdx) => (
                                        <div key={itemIdx} className="flex flex-col gap-1 border-t border-black/5 pt-3 first:border-0 first:pt-0">
                                          <div className="flex items-center justify-between">
                                            <div className="text-[9px] font-black opacity-50">{item.rule}</div>
                                            <div className="text-[10px] font-bold opacity-30 italic">J{item.age}</div>
                                          </div>
                                          <div className="flex items-start justify-between gap-4">
                                            <div className="flex flex-col gap-1 flex-grow">
                                              {isAuthenticated && (
                                                <div className="text-[8px] font-black opacity-30 uppercase tracking-tighter">
                                                  Source: CSV Ligne {item.originalIdx + 2} | Age: J{item.age}
                                                </div>
                                              )}
                                              {isAuthenticated ? (
                                                <input 
                                                  type="text" 
                                                  value={item.notion.text}
                                                  onChange={(e) => handleEditNotion(levelIdx, item.originalIdx, 'text', e.target.value)}
                                                  className="text-sm font-black bg-transparent border-b border-black/10 focus:border-black/30 outline-none w-full"
                                                />
                                              ) : (
                                                <h4 className="text-sm font-black leading-snug">{item.notion.text}</h4>
                                              )}
                                              {item.notion.url && (
                                                <a 
                                                  href={item.notion.url} 
                                                  target="_blank" 
                                                  rel="noopener noreferrer"
                                                  className="flex items-center gap-1.5 text-[10px] font-bold hover:underline opacity-70"
                                                >
                                                  Ressource <ExternalLink className="w-2.5 h-2.5" />
                                                </a>
                                              )}
                                            </div>
                                            
                                            {isAuthenticated && (
                                              <button 
                                                onClick={() => {
                                                  const newLevels = [...data.levels];
                                                  // Stable delete: keep index, clear content
                                                  newLevels[levelIdx].notions[item.originalIdx].text = "";
                                                  newLevels[levelIdx].notions[item.originalIdx].url = "";
                                                  setData({ ...data, levels: newLevels });
                                                }}
                                                className="p-1.5 text-rose-600 hover:bg-rose-100 rounded-lg transition-all"
                                              >
                                                <Trash2 className="w-3.5 h-3.5" />
                                              </button>
                                            )}
                                          </div>
                                        </div>
                                      ))
                                    )}
                                  </div>
                                </motion.div>
                              );
                            })
                          ) : (
                            <div className="p-8 border-2 border-dashed border-slate-200 rounded-3xl flex flex-col items-center justify-center text-center opacity-40 bg-slate-50/50">
                              <Info className="w-8 h-8 text-slate-300 mb-3" />
                              <p className="text-[10px] font-bold text-slate-400 italic">Rien à ce jour</p>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="flex-grow flex flex-col items-center justify-center p-20 text-center bg-slate-50 rounded-[2rem] border border-slate-100 border-dashed">
                  <div className="w-24 h-24 bg-white rounded-[2rem] shadow-xl shadow-slate-100 flex items-center justify-center mb-8">
                    <Calendar className="w-12 h-12 text-slate-200" />
                  </div>
                  <h3 className="text-2xl font-black text-slate-300 mb-2 uppercase tracking-tight">Repos bien mérité</h3>
                  <p className="text-slate-400 font-medium italic">Pas d'école prévue dans le calendrier aujourd'hui.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>

      {/* Settings Modal */}
      <AnimatePresence>
        {showConfig && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-50 flex items-center justify-center p-4 md:p-8"
            onClick={() => setShowConfig(false)}
          >
            <motion.div 
              initial={{ scale: 0.95, y: 30 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 30 }}
              className="bg-white rounded-[3rem] shadow-2xl w-full max-w-5xl max-h-[90vh] overflow-hidden flex flex-col"
              onClick={e => e.stopPropagation()}
            >
              <div className="p-8 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center text-white">
                    <Settings className="w-6 h-6" />
                  </div>
                  <div>
                    <h2 className="text-2xl font-black tracking-tight">Configuration Experte</h2>
                    <p className="text-sm font-bold text-slate-400 uppercase tracking-widest">Gérer vos séquences et votre calendrier</p>
                  </div>
                </div>
                <button onClick={() => setShowConfig(false)} className="p-2 hover:bg-slate-200 rounded-full transition-colors text-slate-400 hover:text-slate-900">
                  <LogOut className="w-6 h-6 rotate-180" />
                </button>
              </div>
              
              <div className="flex-grow overflow-y-auto p-10 custom-scrollbar">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
                  
                  {/* CSV IMPORT */}
                  <section className="space-y-6">
                    <div className="flex items-center justify-between">
                      <h3 className="text-xl font-black flex items-center gap-3">
                        <Upload className="w-5 h-5 text-indigo-600" />
                        Flux de Données CSV
                      </h3>
                    </div>
                    <div className="bg-slate-900 p-6 rounded-[2rem] border border-slate-800 shadow-xl">
                      <div className="grid grid-cols-2 gap-4 mb-6">
                         <div className="flex flex-col gap-2">
                           <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Étape 1 : Téléverser</label>
                           <label className="flex items-center justify-center gap-2 bg-slate-800 border-2 border-dashed border-slate-700 hover:border-indigo-500 py-3 rounded-xl cursor-pointer transition-all">
                             <Upload className="w-4 h-4 text-slate-400" />
                             <span className="text-xs font-bold text-slate-300">Choisir un fichier .csv</span>
                             <input type="file" accept=".csv" onChange={handleFileUpload} className="hidden" />
                           </label>
                         </div>
                         <div className="flex flex-col gap-2">
                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Format</label>
                            <div className="bg-slate-800/50 p-2 rounded-xl text-[9px] text-slate-500 font-mono leading-tight">
                              Niveau1; ; Niveau2; ; CP; ;<br/>
                              Notion; URL; Notion; URL...
                            </div>
                         </div>
                      </div>

                      <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 flex items-center justify-between">
                        Contenu Direct (Optionnel)
                        <button 
                          onClick={handleExportCSV}
                          className="flex items-center gap-1 text-indigo-400 hover:text-indigo-300 transition-colors"
                        >
                          <ExternalLink className="w-3 h-3" />
                          Exporter l'actuel
                        </button>
                      </div>
                      <textarea 
                        value={csvInput}
                        onChange={(e) => setCsvInput(e.target.value)}
                        placeholder="Copiez-collez ici si vous n'avez pas de fichier..."
                        className="w-full h-32 bg-slate-800 text-slate-200 p-4 rounded-2xl font-mono text-xs border border-slate-700 outline-none focus:border-indigo-500 transition-all resize-none"
                      />
                      <button 
                        onClick={handleImportCSV}
                        className="w-full mt-4 bg-indigo-600 text-white py-4 rounded-2xl font-black uppercase tracking-widest text-xs hover:bg-indigo-700 shadow-lg shadow-indigo-900/20 active:scale-95 transition-all"
                      >
                        Traiter le contenu texte
                      </button>
                    </div>
                  </section>

                  {/* CALENDAR CONFIG */}
                  <section className="space-y-8">
                    <div className="bg-white p-8 rounded-[2rem] border border-slate-100 shadow-sm space-y-6">
                      <h3 className="text-xl font-black flex items-center gap-3">
                        <Info className="w-5 h-5 text-indigo-600" />
                        Diagnostic de Progression
                      </h3>
                      
                      <div className="p-6 bg-slate-50 rounded-2xl space-y-4">
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                          <div className="p-4 bg-white rounded-xl border border-slate-200">
                            <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Jour Calendrier</div>
                            <div className="text-xl font-black text-slate-900">{dayNumber}</div>
                          </div>
                          <div className="p-4 bg-white rounded-xl border border-slate-200">
                            <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Retard Configuré</div>
                            <div className="text-xl font-black text-rose-600">-{data.delay}</div>
                          </div>
                          <div className="p-4 bg-indigo-600 rounded-xl text-white">
                            <div className="text-[9px] font-black opacity-60 uppercase tracking-widest">Jour Utile (JU)</div>
                            <div className="text-xl font-black">{jourUtile}</div>
                          </div>
                        </div>

                        <div className="pt-4 border-t border-slate-200">
                          <h4 className="text-xs font-black uppercase tracking-widest text-slate-500 mb-3">Récapitulatif des périodes</h4>
                          <div className="space-y-2">
                            {[...data.periods].sort((a, b) => isBefore(parseISO(a.start), parseISO(b.start)) ? -1 : 1).map(p => {
                              // Count days in this period up to currentDate
                              let count = 0;
                              const pStart = startOfDay(parseISO(p.start));
                              const pEnd = startOfDay(parseISO(p.end));
                              const target = startOfDay(currentDate);
                              
                              if (isAfter(pStart, target)) {
                                count = 0;
                              } else {
                                const wd = p.workDays || [1, 2, 4, 5];
                                let curr = new Date(pStart);
                                while (!isAfter(curr, pEnd) && !isAfter(curr, target)) {
                                  if (wd.includes(curr.getDay())) count++;
                                  curr = addDays(curr, 1);
                                }
                              }

                              return (
                                <div key={p.id} className="flex justify-between items-center text-sm p-3 bg-white rounded-xl border border-slate-100">
                                  <div>
                                    <span className="font-bold">{p.name}</span>
                                    <span className="text-[10px] text-slate-400 ml-2 italic">
                                      ({format(parseISO(p.start), 'dd/MM')} - {format(parseISO(p.end), 'dd/MM')})
                                    </span>
                                  </div>
                                  <div className="font-black text-indigo-600">{count} jours travaillés</div>
                                </div>
                              );
                            })}
                          </div>
                        </div>

                        <p className="text-[10px] text-slate-400 font-bold leading-relaxed italic bg-indigo-50/50 p-4 rounded-xl border border-indigo-100">
                          Note : Si vous observez un décalage, vérifiez que le premier jour de votre progression (Notion 1) correspond bien au Jour Utile 1. 
                          Si vous avez commencé plus tard, le champ "Retard" permet de recalibrer.
                        </p>
                      </div>
                    </div>
                    <div className="bg-white p-8 rounded-[2rem] border border-slate-100 shadow-sm space-y-6">
                      <h3 className="text-xl font-black flex items-center gap-3">
                        <Share2 className="w-5 h-5 text-indigo-600" />
                        Options Générales
                      </h3>
                      
                      <div className="space-y-4">
                        <div className="flex flex-col gap-2">
                          <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Lien des devoirs (URL)</label>
                          <div className="flex gap-2">
                            <input 
                              type="text" 
                              value={homeworkInput}
                              onChange={(e) => setHomeworkInput(e.target.value)}
                              placeholder="https://padlet.com/ce1..."
                              className="w-full bg-slate-50 border border-slate-200 px-4 py-3 rounded-xl text-sm font-medium outline-none focus:bg-white transition-all"
                            />
                            <button 
                              onClick={handleUpdateHomework}
                              className="px-6 bg-indigo-600 text-white rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-indigo-700 transition-all font-sans"
                            >
                              Valider
                            </button>
                          </div>
                        </div>

                        {/* SHARING BUTTONS */}
                        <div className="grid grid-cols-2 gap-4 pt-4 border-t border-slate-100">
                          <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Transmettre aux élèves</label>
                            <button 
                              onClick={() => copyToClipboard(generateShareLink(true), 'share-student')}
                              className="w-full flex items-center justify-center gap-2 bg-emerald-600 text-white py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-emerald-700 transition-all shadow-md active:scale-95"
                            >
                              {copyStatus === 'share-student' ? "Lien copié !" : "URL Élève"}
                            </button>
                          </div>
                          <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Sauvegarde / Édition</label>
                            <button 
                              onClick={() => copyToClipboard(generateShareLink(false), 'share-teacher')}
                              className="w-full flex items-center justify-center gap-2 bg-indigo-600 text-white py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-indigo-700 transition-all shadow-md active:scale-95"
                            >
                              {copyStatus === 'share-teacher' ? "Lien copié !" : "URL Pro (Backup)"}
                            </button>
                          </div>
                        </div>

                        <p className="text-[10px] text-slate-400 font-bold leading-relaxed italic bg-indigo-50/50 p-4 rounded-xl border border-indigo-100 mt-4">
                          Note de déploiement : Votre configuration est stockée localement sur ce navigateur. Pour l'utiliser sur un autre appareil ou pour envoyer le plan de travail aux élèves, utilisez les boutons de partage ci-dessus.
                        </p>

                        <div className="pt-4 border-t border-slate-100">
                          <button 
                            onClick={handleClearData}
                            className="w-full flex items-center justify-center gap-2 bg-rose-50 text-rose-600 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-rose-100 transition-all border border-rose-100"
                          >
                            <Trash2 className="w-4 h-4" />
                            Nettoyer les données (Remise à zéro)
                          </button>
                        </div>
                      </div>
                    </div>

                    <div>
                      <h3 className="text-xl font-black flex items-center gap-3 mb-6">
                        <Calendar className="w-5 h-5 text-indigo-600" />
                        Périodes & Rythmes (Par période)
                      </h3>
                      
                      <div className="space-y-6">
                        {data.periods.map((period, i) => (
                          <div key={period.id} className="bg-slate-50 p-6 rounded-[2rem] border border-slate-100 space-y-4">
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-xs font-black text-indigo-600 uppercase tracking-widest">{period.name}</span>
                              <div className="flex gap-1">
                                {[1, 2, 3, 4, 5].map(d => {
                                  const days = ['L', 'M', 'M', 'J', 'V'];
                                  const isActive = period.workDays.includes(d);
                                  return (
                                    <button 
                                      key={d}
                                      onClick={() => {
                                        const newPeriods = [...data.periods];
                                        newPeriods[i].workDays = isActive 
                                          ? period.workDays.filter(day => day !== d)
                                          : [...period.workDays, d];
                                        setData({ ...data, periods: newPeriods });
                                      }}
                                      className={cn(
                                        "w-6 h-6 rounded flex items-center justify-center text-[10px] font-black transition-all",
                                        isActive ? "bg-indigo-600 text-white shadow-sm" : "bg-white border border-slate-200 text-slate-300"
                                      )}
                                    >
                                      {days[d-1]}
                                    </button>
                                  );
                                })}
                              </div>
                            </div>
                            
                            <div className="grid grid-cols-2 gap-3">
                              <div className="flex flex-col gap-1">
                                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Début</label>
                                <input 
                                  type="date" 
                                  value={period.start}
                                  onChange={(e) => {
                                    const newPeriods = [...data.periods];
                                    newPeriods[i].start = e.target.value;
                                    setData({ ...data, periods: newPeriods });
                                  }}
                                  className="bg-white border border-slate-200 rounded-xl px-2 py-1 text-xs font-bold outline-none"
                                />
                              </div>
                              <div className="flex flex-col gap-1">
                                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Fin</label>
                                <input 
                                  type="date"
                                  value={period.end}
                                  onChange={(e) => {
                                    const newPeriods = [...data.periods];
                                    newPeriods[i].end = e.target.value;
                                    setData({ ...data, periods: newPeriods });
                                  }}
                                  className="bg-white border border-slate-200 rounded-xl px-2 py-1 text-xs font-bold outline-none"
                                />
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </section>

                </div>
              </div>

              <div className="p-8 bg-slate-900 border-t border-slate-800 flex items-center justify-between text-white">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-emerald-500 rounded-full animate-pulse"></div>
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Configuration Active</span>
                </div>
                <button 
                  onClick={() => setShowConfig(false)}
                  className="px-8 py-3 bg-indigo-600 rounded-2xl font-black text-xs uppercase tracking-widest hover:scale-105 active:scale-95 transition-all shadow-lg shadow-indigo-900"
                >
                  Confirmer et Fermer
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <style>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #cbd5e1;
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #334155;
        }
      `}</style>
    </div>
  );
}

function Check({ className }: { className?: string }) {
  return (
    <svg 
      xmlns="http://www.w3.org/2000/svg" 
      width="24" 
      height="24" 
      viewBox="0 0 24 24" 
      fill="none" 
      stroke="currentColor" 
      strokeWidth="4" 
      strokeLinecap="round" 
      strokeLinejoin="round" 
      className={className}
    >
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

function CheckCircle({ className }: { className?: string }) {
  return (
    <svg 
      xmlns="http://www.w3.org/2000/svg" 
      width="24" 
      height="24" 
      viewBox="0 0 24 24" 
      fill="none" 
      stroke="currentColor" 
      strokeWidth="2" 
      strokeLinecap="round" 
      strokeLinejoin="round" 
      className={className}
    >
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
      <polyline points="22 4 12 14.01 9 11.01" />
    </svg>
  );
}
