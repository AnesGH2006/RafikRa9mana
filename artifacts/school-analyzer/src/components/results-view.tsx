import { useLanguage } from "@/contexts/language-provider";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { GradeAnalysisResult } from "@workspace/api-client-react/src/generated/api.schemas";
import { motion } from "framer-motion";
import { 
  GraduationCap, 
  TrendingUp, 
  Award, 
  AlertTriangle, 
  CheckCircle2, 
  XCircle,
  RefreshCcw
} from "lucide-react";

interface ResultsViewProps {
  data: GradeAnalysisResult;
  onReset: () => void;
}

export function ResultsView({ data, onReset }: ResultsViewProps) {
  const { t, dir } = useLanguage();
  const { summary, students } = data;

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1,
      },
    },
  };

  const itemVariants = {
    hidden: { y: 20, opacity: 0 },
    visible: {
      y: 0,
      opacity: 1,
      transition: { type: "spring", stiffness: 100 },
    },
  };

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="space-y-8"
      data-testid="results-container"
    >
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-foreground">{t("summaryStats")}</h2>
          <p className="text-sm text-muted-foreground mt-1">
            {data.fileName} • {data.totalStudents} students
          </p>
        </div>
        <Button onClick={onReset} variant="outline" data-testid="button-reset">
          <RefreshCcw className="mr-2 h-4 w-4 rtl:ml-2 rtl:mr-0" />
          {t("uploadAnother")}
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        <motion.div variants={itemVariants}>
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center space-x-2 rtl:space-x-reverse mb-2">
                <div className="p-2 bg-blue-500/10 rounded-lg">
                  <TrendingUp className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                </div>
                <h3 className="text-sm font-medium text-muted-foreground">{t("classAverage")}</h3>
              </div>
              <p className="text-3xl font-bold">{summary.classAverage.toFixed(1)}</p>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div variants={itemVariants}>
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center space-x-2 rtl:space-x-reverse mb-2">
                <div className="p-2 bg-purple-500/10 rounded-lg">
                  <Award className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                </div>
                <h3 className="text-sm font-medium text-muted-foreground">{t("topStudent")}</h3>
              </div>
              <p className="text-lg font-bold truncate" title={summary.topStudent}>{summary.topStudent}</p>
              <p className="text-xs text-muted-foreground mt-1">{summary.highestAverage.toFixed(1)}</p>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div variants={itemVariants}>
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center space-x-2 rtl:space-x-reverse mb-2">
                <div className="p-2 bg-orange-500/10 rounded-lg">
                  <AlertTriangle className="h-5 w-5 text-orange-600 dark:text-orange-400" />
                </div>
                <h3 className="text-sm font-medium text-muted-foreground">{t("weakestStudent")}</h3>
              </div>
              <p className="text-lg font-bold truncate" title={summary.weakestStudent}>{summary.weakestStudent}</p>
              <p className="text-xs text-muted-foreground mt-1">{summary.lowestAverage.toFixed(1)}</p>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div variants={itemVariants}>
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center space-x-2 rtl:space-x-reverse mb-2">
                <div className="p-2 bg-primary/10 rounded-lg">
                  <GraduationCap className="h-5 w-5 text-primary" />
                </div>
                <h3 className="text-sm font-medium text-muted-foreground">{t("passRate")}</h3>
              </div>
              <p className="text-3xl font-bold">{summary.passRate.toFixed(1)}%</p>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div variants={itemVariants}>
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center space-x-2 rtl:space-x-reverse mb-2">
                <div className="p-2 bg-emerald-500/10 rounded-lg">
                  <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                </div>
                <h3 className="text-sm font-medium text-muted-foreground">{t("passCount")}</h3>
              </div>
              <p className="text-3xl font-bold text-emerald-600 dark:text-emerald-400">{summary.passCount}</p>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div variants={itemVariants}>
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center space-x-2 rtl:space-x-reverse mb-2">
                <div className="p-2 bg-destructive/10 rounded-lg">
                  <XCircle className="h-5 w-5 text-destructive" />
                </div>
                <h3 className="text-sm font-medium text-muted-foreground">{t("failCount")}</h3>
              </div>
              <p className="text-3xl font-bold text-destructive">{summary.failCount}</p>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      <motion.div variants={itemVariants}>
        <Card className="overflow-hidden">
          <CardHeader className="bg-muted/50 border-b">
            <CardTitle>{t("studentResults")}</CardTitle>
          </CardHeader>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-16">{t("rank")}</TableHead>
                  <TableHead>{t("name")}</TableHead>
                  <TableHead className="text-right rtl:text-left">{t("math")}</TableHead>
                  <TableHead className="text-right rtl:text-left">{t("arabic")}</TableHead>
                  <TableHead className="text-right rtl:text-left">{t("science")}</TableHead>
                  <TableHead className="text-right rtl:text-left font-bold">{t("average")}</TableHead>
                  <TableHead className="text-right rtl:text-left">{t("status")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {students.map((student, index) => (
                  <motion.tr
                    key={index}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.05 }}
                    className={`border-b transition-colors ${
                      student.passed 
                        ? "hover:bg-emerald-500/5 dark:hover:bg-emerald-500/10" 
                        : "bg-destructive/5 hover:bg-destructive/10"
                    }`}
                    data-testid={`row-student-${index}`}
                  >
                    <TableCell className="font-medium text-muted-foreground">#{student.rank}</TableCell>
                    <TableCell className="font-semibold">{student.name}</TableCell>
                    <TableCell className="text-right rtl:text-left">{student.math}</TableCell>
                    <TableCell className="text-right rtl:text-left">{student.arabic}</TableCell>
                    <TableCell className="text-right rtl:text-left">{student.science}</TableCell>
                    <TableCell className="text-right rtl:text-left font-bold">{student.average.toFixed(1)}</TableCell>
                    <TableCell className="text-right rtl:text-left">
                      {student.passed ? (
                        <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20 border-emerald-200">
                          {t("pass")}
                        </Badge>
                      ) : (
                        <Badge variant="destructive" className="bg-destructive/90">
                          {t("fail")}
                        </Badge>
                      )}
                    </TableCell>
                  </motion.tr>
                ))}
              </TableBody>
            </Table>
          </div>
        </Card>
      </motion.div>
    </motion.div>
  );
}
