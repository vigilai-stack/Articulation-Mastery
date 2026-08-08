import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { AlertCircle, ArrowDownToLine, BarChart3, Loader2, UsersRound } from "lucide-react";
import { useLocation } from "wouter";

function Cell({ score }: { score: number }) {
  const color = score > 74 ? "bg-[#a5f4c9]/80 text-[#09231b]" : score > 55 ? "bg-[#f4bc79]/80 text-[#2b1c0b]" : "bg-[#ec8d87]/80 text-[#301010]";
  return <span className={`grid h-9 w-11 place-items-center rounded-md text-sm font-semibold ${color}`}>{score || "—"}</span>;
}

export default function Reports() {
  const [, navigate] = useLocation();
  const report = trpc.program.teamReport.useQuery();
  const download = trpc.program.exportTeamCsv.useQuery(undefined, { enabled: false });
  const exportCsv = async () => {
    const result = await download.refetch();
    if (!result.data) return;
    const url = URL.createObjectURL(new Blob([result.data.csv], { type: "text/csv" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = result.data.fileName;
    link.click();
    URL.revokeObjectURL(url);
  };
  if (report.isLoading) return <div className="grid min-h-[60vh] place-items-center"><Loader2 className="h-7 w-7 animate-spin text-[#a5f4c9]"/></div>;
  if (report.error) return <div className="empty-state"><AlertCircle className="h-6 w-6 text-[#f4bc79]"/><p>{report.error.message}</p></div>;
  const data = report.data!;
  const gaps = Object.entries(data.skillGaps);
  return <div className="workspace-content"><div className="flex flex-wrap items-end justify-between gap-5"><div><p className="eyebrow">Manager workspace</p><h1 className="mt-3 font-display text-4xl tracking-[-.03em] text-white sm:text-5xl">Make capability visible.</h1><p className="mt-4 max-w-2xl leading-7 text-[#a5beb6]">A focused view of completion, confidence signals, and where a team might benefit from targeted practice.</p></div><Button disabled={download.isFetching} onClick={exportCsv} className="premium-button">{download.isFetching ? <Loader2 className="h-4 w-4 animate-spin"/> : <><ArrowDownToLine className="mr-2 h-4 w-4"/>Export CSV</>}</Button></div><section className="mt-8 grid gap-5 md:grid-cols-3"><article className="insight-card"><UsersRound className="h-5 w-5 text-[#a5f4c9]"/><p className="mt-5 text-3xl font-semibold text-white">{data.learners.length}</p><p className="mt-1 text-sm text-[#9bb4a9]">assigned learners</p></article><article className="insight-card"><BarChart3 className="h-5 w-5 text-[#f4bc79]"/><p className="mt-5 text-3xl font-semibold text-white">{data.completionRate}%</p><p className="mt-1 text-sm text-[#9bb4a9]">team completion rate</p></article><article className="insight-card"><span className="grid h-5 w-5 place-items-center rounded-full bg-[#ec8d87] text-[10px] font-bold text-[#301010]">!</span><p className="mt-5 text-3xl font-semibold text-white">{data.reviewedPracticeCount}</p><p className="mt-1 text-sm text-[#9bb4a9]">reviewed practice sessions</p></article></section><section className="mt-5 grid gap-5 xl:grid-cols-[.8fr_1.2fr]"><article className="section-card"><p className="text-sm text-[#9bb4a9]">Skill gap heatmap</p><h2 className="mt-2 text-xl font-semibold text-white">Team communication signal</h2><div className="mt-6 grid grid-cols-4 gap-2">{gaps.map(([skill, score]) => <div key={skill} className="text-center"><Cell score={score}/><p className="mt-2 text-xs capitalize text-[#9bb4a9]">{skill}</p></div>)}</div><p className="mt-6 border-t border-white/10 pt-5 text-sm leading-6 text-[#9bb4a9]">Green signals established practice. Amber signals an area to reinforce. Red identifies a possible capability focus for coaching or team sessions.</p></article><article className="section-card overflow-x-auto"><p className="text-sm text-[#9bb4a9]">Learner progress summary</p><table className="report-table mt-5 min-w-[690px]"><thead><tr><th>Learner</th><th>Completion</th><th>Clarity</th><th>Concise</th><th>Confidence</th><th>Structure</th></tr></thead><tbody>{data.learners.map(learner => <tr key={learner.id}><td><button onClick={() => navigate(`/reports/${learner.id}`)} className="text-left"><p className="font-medium text-white transition hover:text-[#a5f4c9]">{learner.name}</p><p className="mt-0.5 text-xs text-[#78948a]">{learner.email}</p></button></td><td><span className="text-[#a5f4c9]">{learner.completionRate}%</span><div className="mt-1.5 h-1 w-20 rounded-full bg-white/10"><div className="h-full rounded-full bg-[#a5f4c9]" style={{width:`${learner.completionRate}%`}}/></div></td><td>{learner.scores.clarity || "—"}</td><td>{learner.scores.conciseness || "—"}</td><td>{learner.scores.confidence || "—"}</td><td>{learner.scores.structure || "—"}</td></tr>)}</tbody></table>{!data.learners.length && <div className="py-10 text-center text-sm text-[#9bb4a9]">No learners have been assigned to this reporting view yet.</div>}</article></section></div>;
}
