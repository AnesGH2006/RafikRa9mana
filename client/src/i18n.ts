type TranslationMap = {
  [key: string]: { en: string; ar: string; fr: string };
};

export const translations: TranslationMap = {
  appName: { en: "CEM Manager", ar: "مدير المتوسطة", fr: "Gestionnaire CEM" },

  // Sidebar sections
  "nav.students_section": { en: "Students", ar: "التلاميذ", fr: "Élèves" },
  "nav.results_section":  { en: "Results",  ar: "النتائج", fr: "Résultats" },
  "nav.yearend_section":  { en: "End of Year", ar: "أعمال نهاية السنة", fr: "Fin d'année" },
  "nav.orient_section":   { en: "Pre-orientation", ar: "التوجيه المسبق", fr: "Pré-orientation" },
  "nav.data_section":     { en: "Data", ar: "البيانات", fr: "Données" },
  "nav.more_section":     { en: "More", ar: "المزيد", fr: "Plus" },

  // Nav items
  "nav.dashboard":    { en: "Dashboard",       ar: "لوحة التحكم",       fr: "Tableau de bord" },
  "nav.students":     { en: "Student List",    ar: "قائمة التلاميذ",    fr: "Liste des élèves" },
  "nav.ages":         { en: "Age Distribution",ar: "أعمار التلاميذ",    fr: "Répartition par âge" },
  "nav.results":      { en: "Student Results", ar: "نتائج التلاميذ",    fr: "Résultats des élèves" },
  "nav.subjects":     { en: "Subject Results", ar: "نتائج المواد",      fr: "Résultats par matière" },
  "nav.failed":       { en: "Failed Students", ar: "التلاميذ الراسبين", fr: "Élèves en échec" },
  "nav.repeaters":    { en: "Repeating Students", ar: "التلاميذ المعيدين", fr: "Redoublants" },
  "nav.absences":     { en: "Absences",        ar: "الغيابات",          fr: "Absences" },
  "nav.yearend":      { en: "Annual Results",  ar: "النتائج السنوية",   fr: "Résultats annuels" },
  "nav.passed_list":  { en: "Passed List",     ar: "قوائم الناجحين",   fr: "Liste des admis" },
  "nav.failed_list":  { en: "Failed List",     ar: "قوائم الراسبين",   fr: "Liste des non admis" },
  "nav.final_list":   { en: "Final List",      ar: "القوائم النهائية", fr: "Listes finales" },
  "nav.orientation":  { en: "Final Orientation", ar: "التوجيه النهائي", fr: "Orientation finale" },
  "nav.bem":          { en: "BEM Results",     ar: "نتائج BEM",        fr: "Résultats BEM" },
  "nav.import":       { en: "Import Data",     ar: "استيراد البيانات", fr: "Importer des données" },
  "nav.archive":      { en: "Archive",         ar: "أرشفة البيانات",  fr: "Archivage" },
  "nav.settings":     { en: "School Info",     ar: "معلومات المؤسسة", fr: "Infos établissement" },
  "nav.account":      { en: "Account",         ar: "معلومات الحساب",  fr: "Compte" },
  "nav.logout":       { en: "Log Out",         ar: "تسجيل الخروج",    fr: "Déconnexion" },

  // Login
  "login.hero":     { en: "Manage your CEM school efficiently", ar: "أدر متوسطتك بكفاءة", fr: "Gérez votre CEM efficacement" },
  "login.subtitle": { en: "Student records, results, statistics and more.", ar: "سجلات التلاميذ والنتائج والإحصائيات وأكثر.", fr: "Dossiers, résultats, statistiques et plus." },
  "login.cta":      { en: "Log In", ar: "دخول", fr: "Se connecter" },
  "login.feature1": { en: "Student registry with filters", ar: "سجل التلاميذ مع فلترة",          fr: "Registre des élèves avec filtres" },
  "login.feature2": { en: "Trimester grades & averages",   ar: "نقاط الفصول والمعدلات",          fr: "Notes par trimestre et moyennes" },
  "login.feature3": { en: "Dashboard with live stats",     ar: "لوحة تحكم بإحصائيات مباشرة",    fr: "Tableau de bord avec stats en direct" },
  "login.feature4": { en: "Printable year-end lists",      ar: "قوائم نهاية السنة للطباعة",      fr: "Listes de fin d'année imprimables" },

  // Dashboard
  "dashboard.title":      { en: "Dashboard",          ar: "لوحة التحكم",         fr: "Tableau de bord" },
  "dashboard.schoolInfo": { en: "School Information", ar: "معلومات المؤسسة",    fr: "Informations de l'établissement" },
  "dashboard.editInfo":   { en: "Edit Info",           ar: "تعديل المعلومات",    fr: "Modifier les infos" },
  "dashboard.schoolName": { en: "School Name",         ar: "اسم المتوسطة",       fr: "Nom de l'établissement" },
  "dashboard.wilaya":     { en: "Wilaya",              ar: "الولاية",             fr: "Wilaya" },
  "dashboard.commune":    { en: "Commune",             ar: "البلدية",             fr: "Commune" },
  "dashboard.year":       { en: "Academic Year",       ar: "السنة الدراسية",     fr: "Année scolaire" },
  "dashboard.save":       { en: "Save",                ar: "حفظ",                fr: "Enregistrer" },
  "dashboard.cancel":     { en: "Cancel",              ar: "إلغاء",              fr: "Annuler" },
  "dashboard.noSchool":   { en: "Set up your school info to get started", ar: "أدخل معلومات مؤسستك للبدء", fr: "Renseignez votre établissement pour commencer" },
  "dashboard.setup":      { en: "Set Up School",       ar: "إعداد المؤسسة",      fr: "Configurer l'école" },

  // Stats
  "stats.total":     { en: "Total Students", ar: "مجموع التلاميذ", fr: "Total élèves" },
  "stats.boys":      { en: "Boys",           ar: "ذكور",           fr: "Garçons" },
  "stats.girls":     { en: "Girls",          ar: "إناث",           fr: "Filles" },
  "stats.admis":     { en: "Admitted",       ar: "ناجحون",         fr: "Admis" },
  "stats.nonAdmis":  { en: "Failed",         ar: "راسبون",         fr: "Non admis" },
  "stats.byLevel":   { en: "By Level",       ar: "حسب المستوى",   fr: "Par niveau" },
  "stats.level":     { en: "Level",          ar: "المستوى",        fr: "Niveau" },
  "stats.total_col": { en: "Total",          ar: "المجموع",        fr: "Total" },
  "stats.results":   { en: "Results",        ar: "النتائج",        fr: "Résultats" },
  "stats.noData":    { en: "No students yet. Import a file to see stats.", ar: "لا توجد بيانات. استورد ملفًا لعرض الإحصائيات.", fr: "Aucun élève. Importez un fichier pour voir les stats." },

  // Students
  "students.title":          { en: "Student List",         ar: "قائمة التلاميذ",        fr: "Liste des élèves" },
  "students.import":         { en: "Import Excel",         ar: "استيراد Excel",         fr: "Importer Excel" },
  "students.importing":      { en: "Importing...",         ar: "جارٍ الاستيراد...",    fr: "Importation..." },
  "students.delete":         { en: "Delete All",           ar: "حذف الكل",             fr: "Tout supprimer" },
  "students.confirmDelete":  { en: "Delete all students?", ar: "حذف جميع التلاميذ؟",  fr: "Supprimer tous les élèves ?" },
  "students.confirmDeleteDesc": { en: "This action cannot be undone.", ar: "لا يمكن التراجع عن هذا الإجراء.", fr: "Cette action est irréversible." },
  "students.confirm":        { en: "Confirm",              ar: "تأكيد",                fr: "Confirmer" },
  "students.search":         { en: "Search by name...",    ar: "ابحث بالاسم...",       fr: "Rechercher par nom..." },
  "students.filterLevel":    { en: "Level",                ar: "المستوى",              fr: "Niveau" },
  "students.filterClass":    { en: "Class",                ar: "القسم",                fr: "Classe" },
  "students.filterGender":   { en: "Gender",               ar: "الجنس",               fr: "Genre" },
  "students.filterStatus":   { en: "Status",               ar: "الحالة",               fr: "Statut" },
  "students.filterYear":     { en: "Year",                 ar: "السنة",               fr: "Année" },
  "students.all":            { en: "All",                  ar: "الكل",                fr: "Tous" },
  "students.allLevels":      { en: "All Levels",           ar: "كل المستويات",        fr: "Tous niveaux" },
  "students.allClasses":     { en: "All Classes",          ar: "كل الأقسام",          fr: "Toutes classes" },
  "students.allGenders":     { en: "All",                  ar: "الكل",                fr: "Tous" },
  "students.allStatuts":     { en: "All",                  ar: "الكل",                fr: "Tous" },
  "students.empty":          { en: "No students found.",   ar: "لم يتم العثور على تلاميذ.", fr: "Aucun élève trouvé." },
  "students.importSuccess":  { en: "Import successful",    ar: "تم الاستيراد بنجاح",  fr: "Import réussi" },
  "students.importError":    { en: "Import error",         ar: "خطأ في الاستيراد",    fr: "Erreur d'import" },

  // Results page
  "results.title":      { en: "Student Results",   ar: "نتائج التلاميذ",   fr: "Résultats des élèves" },
  "results.t1":         { en: "T1",                ar: "ف1",               fr: "T1" },
  "results.t2":         { en: "T2",                ar: "ف2",               fr: "T2" },
  "results.t3":         { en: "T3",                ar: "ف3",               fr: "T3" },
  "results.annual":     { en: "Annual",            ar: "السنوي",           fr: "Annuel" },
  "results.rank":       { en: "Rank",              ar: "الرتبة",           fr: "Rang" },
  "results.enterGrades":{ en: "Enter Grades",      ar: "إدخال النقاط",     fr: "Saisir les notes" },
  "results.saveGrades": { en: "Save",              ar: "حفظ",              fr: "Enregistrer" },
  "results.trimestre":  { en: "Trimester",         ar: "الفصل",            fr: "Trimestre" },
  "results.noGrades":   { en: "No grades entered yet", ar: "لم يتم إدخال نقاط بعد", fr: "Aucune note saisie" },
  "results.score":      { en: "Score / 20",        ar: "النقطة / 20",      fr: "Note / 20" },
  "results.avg":        { en: "Average",           ar: "المعدل",           fr: "Moyenne" },
  "results.coef":       { en: "Coef.",             ar: "المعامل",          fr: "Coef." },
  "results.subject":    { en: "Subject",           ar: "المادة",           fr: "Matière" },
  "results.pass":       { en: "Pass",              ar: "ناجح",             fr: "Admis" },
  "results.fail":       { en: "Fail",              ar: "راسب",             fr: "Non admis" },
  "results.empty":      { en: "No students found. Import student data first.", ar: "لا يوجد تلاميذ. استورد قائمة التلاميذ أولاً.", fr: "Aucun élève. Importez d'abord les élèves." },

  // Subjects page
  "subjects.title":     { en: "Subject Results",  ar: "نتائج المواد",     fr: "Résultats par matière" },
  "subjects.avg":       { en: "Class Average",    ar: "معدل القسم",       fr: "Moyenne de classe" },
  "subjects.best":      { en: "Best Subject",     ar: "أحسن مادة",        fr: "Meilleure matière" },
  "subjects.worst":     { en: "Weakest Subject",  ar: "أضعف مادة",        fr: "Matière la plus faible" },
  "subjects.passRate":  { en: "Pass Rate",        ar: "نسبة النجاح",      fr: "Taux de réussite" },
  "subjects.noData":    { en: "No grades yet.",   ar: "لا توجد نقاط بعد.",fr: "Aucune note." },

  // Year-end
  "yearend.title":      { en: "Year-End Lists",   ar: "قوائم نهاية السنة", fr: "Listes de fin d'année" },
  "yearend.passed":     { en: "Passed",           ar: "الناجحون",         fr: "Admis" },
  "yearend.failed":     { en: "Failed",           ar: "الراسبون",         fr: "Non admis" },
  "yearend.all":        { en: "All Students",     ar: "كل التلاميذ",      fr: "Tous les élèves" },
  "yearend.print":      { en: "Print",            ar: "طباعة",            fr: "Imprimer" },
  "yearend.export":     { en: "Export Excel",     ar: "تصدير Excel",      fr: "Exporter Excel" },
  "yearend.noData":     { en: "No results yet. Enter grades first.", ar: "لا توجد نتائج. أدخل النقاط أولاً.", fr: "Aucun résultat. Saisissez d'abord les notes." },

  // Import
  "import.title":       { en: "Import Data",      ar: "استيراد البيانات", fr: "Importer des données" },
  "import.students":    { en: "Students (Excel)", ar: "التلاميذ (Excel)",fr: "Élèves (Excel)" },
  "import.drop":        { en: "Drop file or click to browse", ar: "أسقط الملف هنا أو انقر للتصفح", fr: "Déposez ou cliquez pour parcourir" },
  "import.formats":     { en: "Accepts .xlsx and .xls files", ar: "يقبل ملفات .xlsx و .xls", fr: "Accepte .xlsx et .xls" },
  "import.tip":         { en: "Required columns: student name, level, class, gender", ar: "الأعمدة المطلوبة: الاسم، المستوى، القسم، الجنس", fr: "Colonnes requises: nom, niveau, classe, genre" },

  // Settings
  "settings.title":     { en: "School Information", ar: "معلومات المؤسسة", fr: "Informations de l'établissement" },
  "settings.director":  { en: "Director",            ar: "المدير",          fr: "Directeur" },
  "settings.phone":     { en: "Phone",               ar: "الهاتف",          fr: "Téléphone" },
  "settings.saved":     { en: "Settings saved",      ar: "تم حفظ الإعدادات",fr: "Paramètres enregistrés" },
  "settings.account":   { en: "Account Information", ar: "معلومات الحساب", fr: "Informations du compte" },

  // Absences
  "absences.title":     { en: "Student Absences",  ar: "غيابات التلاميذ",  fr: "Absences des élèves" },
  "absences.justified": { en: "Justified Hours",   ar: "ساعات مبررة",      fr: "Heures justifiées" },
  "absences.unjustified":{ en: "Unjustified Hours",ar: "ساعات غير مبررة", fr: "Heures non justifiées" },
  "absences.total":     { en: "Total Hours",       ar: "المجموع",          fr: "Total heures" },

  // Table columns
  "col.name":     { en: "Full Name",    ar: "الاسم واللقب",  fr: "Nom et prénom" },
  "col.birth":    { en: "Date of Birth",ar: "تاريخ الميلاد", fr: "Date de naissance" },
  "col.level":    { en: "Level",        ar: "المستوى",       fr: "Niveau" },
  "col.class":    { en: "Class",        ar: "القسم",         fr: "Classe" },
  "col.gender":   { en: "Gender",       ar: "الجنس",         fr: "Genre" },
  "col.status":   { en: "Status",       ar: "الحالة",        fr: "Statut" },
  "col.result":   { en: "Result",       ar: "النتيجة",       fr: "Résultat" },
  "col.rank":     { en: "Rank",         ar: "الرتبة",        fr: "Rang" },
  "col.avg":      { en: "Average",      ar: "المعدل",        fr: "Moyenne" },
  "col.t1":       { en: "T1",           ar: "ف1",            fr: "T1" },
  "col.t2":       { en: "T2",           ar: "ف2",            fr: "T2" },
  "col.t3":       { en: "T3",           ar: "ف3",            fr: "T3" },

  // Values
  "val.male":       { en: "Male",     ar: "ذكر",    fr: "Masculin" },
  "val.female":     { en: "Female",   ar: "أنثى",  fr: "Féminin" },
  "val.nouveau":    { en: "New",      ar: "جديد",  fr: "Nouveau" },
  "val.redoublant": { en: "Repeater", ar: "معيد",  fr: "Redoublant" },
  "val.admis":      { en: "Admitted", ar: "ناجح",  fr: "Admis" },
  "val.non_admis":  { en: "Failed",   ar: "راسب",  fr: "Non admis" },
  "val.na":         { en: "—",        ar: "—",     fr: "—" },

  toggleTheme: { en: "Toggle Theme", ar: "تبديل المظهر", fr: "Changer de thème" },
};
