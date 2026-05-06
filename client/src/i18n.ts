type TranslationMap = {
  [key: string]: {
    en: string;
    ar: string;
    fr: string;
  };
};

export const translations: TranslationMap = {
  // App
  appName: {
    en: "School Grade Analyzer",
    ar: "محلل درجات المدرسة",
    fr: "Analyseur de Notes Scolaires",
  },
  
  // Upload Page
  uploadTitle: {
    en: "Upload Gradebook",
    ar: "تحميل سجل الدرجات",
    fr: "Télécharger le carnet de notes",
  },
  uploadDesc: {
    en: "Select an Excel file (.xlsx, .xls) to analyze student performance.",
    ar: "حدد ملف إكسل (.xlsx، .xls) لتحليل أداء الطلاب.",
    fr: "Sélectionnez un fichier Excel (.xlsx, .xls) pour analyser les performances des élèves.",
  },
  dragDrop: {
    en: "Drag & drop your Excel file here",
    ar: "اسحب وأفلت ملف الإكسل هنا",
    fr: "Glissez et déposez votre fichier Excel ici",
  },
  orBrowse: {
    en: "or click to browse",
    ar: "أو انقر للتصفح",
    fr: "ou cliquez pour parcourir",
  },
  analyzing: {
    en: "Analyzing grades...",
    ar: "جاري تحليل الدرجات...",
    fr: "Analyse des notes en cours...",
  },
  uploadError: {
    en: "Error uploading file",
    ar: "خطأ في تحميل الملف",
    fr: "Erreur lors du téléchargement",
  },
  
  // Summary Cards
  summaryStats: {
    en: "Summary Statistics",
    ar: "إحصائيات ملخصة",
    fr: "Statistiques Résumées",
  },
  classAverage: {
    en: "Class Average",
    ar: "متوسط الفصل",
    fr: "Moyenne de la classe",
  },
  topStudent: {
    en: "Top Student",
    ar: "الطالب المتفوق",
    fr: "Meilleur élève",
  },
  weakestStudent: {
    en: "Needs Support",
    ar: "يحتاج إلى دعم",
    fr: "Besoin de soutien",
  },
  passRate: {
    en: "Pass Rate",
    ar: "نسبة النجاح",
    fr: "Taux de réussite",
  },
  passCount: {
    en: "Passed",
    ar: "الناجحون",
    fr: "Admis",
  },
  failCount: {
    en: "Failed",
    ar: "الراسبون",
    fr: "Échoué",
  },
  
  // Table
  studentResults: {
    en: "Student Results",
    ar: "نتائج الطلاب",
    fr: "Résultats des élèves",
  },
  rank: {
    en: "Rank",
    ar: "الرتبة",
    fr: "Rang",
  },
  name: {
    en: "Name",
    ar: "الاسم",
    fr: "Nom",
  },
  average: {
    en: "Average",
    ar: "المتوسط",
    fr: "Moyenne",
  },
  status: {
    en: "Status",
    ar: "الحالة",
    fr: "Statut",
  },
  pass: {
    en: "Pass",
    ar: "ناجح",
    fr: "Admis",
  },
  fail: {
    en: "Fail",
    ar: "راسب",
    fr: "Échoué",
  },
  
  // Actions
  uploadAnother: {
    en: "Upload Another File",
    ar: "تحميل ملف آخر",
    fr: "Télécharger un autre fichier",
  },
  toggleTheme: {
    en: "Toggle Theme",
    ar: "تبديل المظهر",
    fr: "Changer de thème",
  },
  
  // New translations for T001
  "nav.analyzer": {
    en: "Analyzer",
    ar: "المحلل",
    fr: "Analyseur",
  },
  "nav.myPlan": {
    en: "My Plan",
    ar: "اشتراكي",
    fr: "Mon Abonnement",
  },
  "nav.logout": {
    en: "Log Out",
    ar: "تسجيل الخروج",
    fr: "Déconnexion",
  },
  "login.hero": {
    en: "Analyze class grades instantly",
    ar: "حلّل نتائج قسمك في ثوانٍ",
    fr: "Analysez les notes instantanément",
  },
  "login.subtitle": {
    en: "The smartest tool for modern educators.",
    ar: "الأداة الأذكى للمعلمين المعاصرين.",
    fr: "L'outil le plus intelligent pour les éducateurs modernes.",
  },
  "login.cta": {
    en: "Log In",
    ar: "دخول",
    fr: "Se connecter",
  },
  "login.feature1": {
    en: "Upload Excel gradebooks easily",
    ar: "تحميل سجلات الدرجات بسهولة",
    fr: "Téléchargez des carnets de notes Excel facilement",
  },
  "login.feature2": {
    en: "Instant statistical insights",
    ar: "رؤى إحصائية فورية",
    fr: "Aperçus statistiques instantanés",
  },
  "login.feature3": {
    en: "CEM & Lycée modes supported",
    ar: "يدعم التعليم المتوسط والثانوي",
    fr: "Modes CEM et Lycée pris en charge",
  },
  "login.feature4": {
    en: "Exportable analytics reports",
    ar: "تقارير تحليلية قابلة للتصدير",
    fr: "Rapports d'analyse exportables",
  },
  "pricing.title": {
    en: "Choose Your Plan",
    ar: "اختر باقتك",
    fr: "Choisissez votre abonnement",
  },
  "pricing.subtitle": {
    en: "Unlock the full potential of your grade analysis.",
    ar: "أطلق العنان للإمكانيات الكاملة لتحليل الدرجات.",
    fr: "Libérez tout le potentiel de votre analyse de notes.",
  },
  "pricing.currentPlan": {
    en: "Current Plan",
    ar: "الباقة الحالية",
    fr: "Abonnement actuel",
  },
  "pricing.activate": {
    en: "Activate",
    ar: "تفعيل",
    fr: "Activer",
  },
  "pricing.mostPopular": {
    en: "Most Popular",
    ar: "الأكثر شيوعاً",
    fr: "Le plus populaire",
  },
  "pricing.schoolMode": {
    en: "School Mode:",
    ar: "الطور التعليمي:",
    fr: "Niveau Scolaire:",
  },
  "pricing.cem": {
    en: "CEM (Middle School)",
    ar: "التعليم المتوسط",
    fr: "CEM (Collège)",
  },
  "pricing.lycee": {
    en: "Lycée (High School)",
    ar: "التعليم الثانوي",
    fr: "Lycée",
  },
  "pricing.free": {
    en: "Free",
    ar: "مجاني",
    fr: "Gratuit",
  },
  "mode.title": {
    en: "School Mode",
    ar: "الطور التعليمي",
    fr: "Niveau Scolaire",
  },
  "mode.cem": {
    en: "CEM",
    ar: "المتوسط",
    fr: "CEM",
  },
  "mode.lycee": {
    en: "Lycée",
    ar: "الثانوي",
    fr: "Lycée",
  },
  "mode.upgradeRequired": {
    en: "Upgrade to Pro",
    ar: "رقّ للاحترافية",
    fr: "Passez à Pro",
  },
  "subject.arabic": {
    en: "Arabic",
    ar: "العربية",
    fr: "Arabe",
  },
  "subject.french": {
    en: "French",
    ar: "الفرنسية",
    fr: "Français",
  },
  "subject.math": {
    en: "Math",
    ar: "الرياضيات",
    fr: "Mathématiques",
  },
  "subject.science": {
    en: "Science",
    ar: "العلوم",
    fr: "Sciences",
  },
  "subject.islamic": {
    en: "Islamic Ed.",
    ar: "التربية الإسلامية",
    fr: "Éd. islamique",
  },
  "subject.history": {
    en: "History/Geo",
    ar: "التاريخ والجغرافيا",
    fr: "Histoire-Géo",
  },
  "subject.physics": {
    en: "Physics",
    ar: "الفيزياء",
    fr: "Physique-Chimie",
  },
  "subject.english": {
    en: "English",
    ar: "الإنجليزية",
    fr: "Anglais",
  },
  "subject.philosophy": {
    en: "Philosophy",
    ar: "الفلسفة",
    fr: "Philosophie",
  },
  "plan.gratuit": {
    en: "Trial",
    ar: "تجريبي",
    fr: "Essai",
  },
  "plan.standard": {
    en: "Standard",
    ar: "العادية",
    fr: "Standard",
  },
  "plan.pro": {
    en: "Pro",
    ar: "الاحترافية",
    fr: "Pro",
  },
  "plan.max": {
    en: "Max",
    ar: "الشاملة",
    fr: "Max",
  },
};
