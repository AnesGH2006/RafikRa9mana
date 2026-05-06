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
  math: {
    en: "Math",
    ar: "الرياضيات",
    fr: "Mathématiques",
  },
  arabic: {
    en: "Arabic",
    ar: "اللغة العربية",
    fr: "Arabe",
  },
  science: {
    en: "Science",
    ar: "العلوم",
    fr: "Sciences",
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
  }
};
