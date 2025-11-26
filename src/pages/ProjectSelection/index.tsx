import React, { useEffect, useState } from "react";
import { useParams } from "react-router";
import Header from "../../components/project-manager/Header";
import IconViewToggle from "../../components/project-manager/IconViewToggle";
import EmblaIOSCarousel from "../../components/project-selection/EmblaIOSCarousel";
import ProjectActionSheet from "../../components/project-selection/ProjectActionSheet";
import ProjectListNew from "../../components/project-selection/ProjectListNew";

import { initSession } from "../../utils/sessionStorage";
import { getSelectedPack } from "../../utils/packStorage";
import { getAllProjects, getAllPacks, getPackKeywords, getAllStories } from "../../utils/manifest";
import { loadProjects } from "../../utils/projectStorage";

/**
 * ProjectSelection — improved matching that treats pack.items as project selectors.
 *
 * در نسخه‌ی جدید:
 * اگر pack.projects وجود داشته باشد، همان به عنوان لیست پروژه‌های این پَک استفاده می‌شود.
 * فقط برای پَک‌های قدیمی / اسکن‌شده که projects ندارند، از منطق items/keywords استفاده می‌کنیم.
 */

type Project = {
  id: string;
  name?: string;
  subtitle?: string;
  category?: string;
  imgsPath?: string;
  project?: any;
  checkpoints?: { id: string; title?: string }[];
  isLock?: boolean;
  lockReason?: string;
  [key: string]: any;
};

const normalize = (s: string | undefined | null) => String(s ?? "").trim().toLowerCase();

/** small slugify helper to try filename-like candidates */
function slugify(s?: string | null) {
  return String(s ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\u0600-\u06FF\-_]+/gi, "-")
    .replace(/_{2,}/g, "-")
    .replace(/\-+/g, "-")
    .replace(/(^\-|\-$)/g, "");
}

/** candidateFromStoryModule helper reused from other components */
function candidateFromStoryModule(storyModule?: string) {
  if (!storyModule) return [];
  let sm = storyModule;
  if (sm.startsWith("src/")) sm = sm.slice(4);
  if (sm.startsWith("/")) sm = sm.slice(1);
  const base = `../../${sm}`;
  const withoutIndex = base.replace(/\/index\.(ts|js)x?$/i, "");
  return [base, withoutIndex];
}

const ProjectSelection: React.FC = () => {
  const { packId: paramPackId } = useParams<{ packId?: string }>();
  const [view, setView] = useState<"carousel" | "list">("carousel");
  const [openProject, setOpenProject] = useState<any | null>(null);

  const [displayProjects, setDisplayProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [selectedPackId, setSelectedPackId] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        // Load manifest projects (only projects) + packs + persisted projects
        const manifestProjects = (getAllProjects() || []) as Project[];
        const manifestPacks = (getAllPacks() || []) as any[];
        const persistedProjects = (await loadProjects().catch(() => [])) as Project[];
        const manifestStories = getAllStories() || [];

        // Merge projects: persisted overrides manifest
        const projectsMap = new Map<string, Project>();
        for (const p of manifestProjects) {
          if (p && p.id) projectsMap.set(p.id, p);
        }
        for (const p of persistedProjects) {
          if (p && p.id) projectsMap.set(p.id, p);
        }
        const allProjects = Array.from(projectsMap.values());

        // Attempt to enrich projects using dynamic story imports (non-fatal)
        const enriched = await Promise.all(
          allProjects.map(async (p) => {
            let storyObj: any = null;
            try {
              // try a few candidates so localized ids still match a filename under assets/stories
              const candidates = new Set<string>();
              candidates.add(String(p.id));
              if (p.name) candidates.add(slugify(p.name));
              candidates.add(slugify(p.id));
              const asciiId = String(p.id || "").replace(/[^\x00-\x7F]/g, "");
              if (asciiId) candidates.add(slugify(asciiId));

              // add manifest storyModule-derived candidates (if any)
              for (const s of manifestStories) {
                try {
                  if (!s) continue;
                  // if s.projectId matches this project id/name, prioritize its module
                  if (
                    String(s.projectId) === String(p.id) ||
                    slugify(String(s.projectId)) === slugify(p.id) ||
                    slugify(String(s.projectId)) === slugify(p.name)
                  ) {
                    const arr = candidateFromStoryModule(s.storyModule);
                    arr.forEach((c) => candidates.add(c.replace(/^src\//, "").replace(/^\/+/, "")));
                  } else {
                    // still add storyModule as a candidate in case filenames don't align exactly
                    const arr = candidateFromStoryModule(s.storyModule);
                    arr.forEach((c) => candidates.add(c.replace(/^src\//, "").replace(/^\/+/, "")));
                  }
                } catch {
                  // ignore
                }
              }

              for (const cand of Array.from(candidates)) {
                if (!cand) continue;
                const tryPaths = [
                  `../../assets/stories/${cand}`,
                  `../../assets/stories/${cand}/index`,
                  cand,
                  `../../${cand}`,
                ];
                for (const pth of tryPaths) {
                  try {
                    // eslint-disable-next-line no-await-in-loop
                    const mod: any = await import(pth).catch(() => null);
                    if (mod) {
                      // try a few keys; keep old behaviour
                      storyObj =
                        mod[p.id] ??
                        mod.default ??
                        mod[slugify(p.id)] ??
                        mod.car ??
                        mod;
                      if (storyObj) break;
                    }
                  } catch {
                    // ignore
                  }
                }
                if (storyObj) break;
              }
            } catch {
              /* ignore */
            }

            let checkpoints = Array.isArray((p as any).checkpoints) ? (p as any).checkpoints : undefined;
            if ((!checkpoints || checkpoints.length === 0) && storyObj && typeof storyObj === "object") {
              checkpoints = Object.keys(storyObj).map((k) => ({ id: k, title: k }));
            }

            return {
              ...p,
              project: storyObj ?? (p as any).project,
              checkpoints: checkpoints ?? (p as any).checkpoints ?? [],
            } as Project;
          })
        );

        // Decide pack id to use (URL param preferred)
        const selFromStorage = await getSelectedPack();
        const selPack = paramPackId ? decodeURIComponent(paramPackId) : selFromStorage ?? null;
        setSelectedPackId(selPack);

        let filtered: Project[] = enriched;

        if (selPack) {
          // find pack definition by id
          const packDef = manifestPacks.find((pk: any) => String(pk.id) === String(selPack));

          // --- NEW: if pack has explicit `projects`, use them as the ground truth ---
          const packProjects: any[] = Array.isArray((packDef as any)?.projects)
            ? ((packDef as any).projects as any[])
            : [];

          if (packProjects.length > 0) {
            const matchedProjects: Project[] = [];
            const seenIds = new Set<string>();

            for (const rawProj of packProjects) {
              if (!rawProj) continue;

              const key = String(rawProj.id ?? rawProj.name ?? "").trim();
              if (!key) continue;
              const keyNorm = normalize(key);

              // try to find a corresponding enriched project
              let proj =
                enriched.find(
                  (p) => normalize(p.id) === keyNorm || normalize(p.name) === keyNorm
                ) || null;

              // if not found, build a minimal project entry from pack data
              if (!proj) {
                proj = {
                  id: key,
                  name: rawProj.name ?? key,
                  subtitle: rawProj.subtitle,
                  category: rawProj.category,
                  imgsPath: rawProj.imgsPath,
                  isLock: rawProj.isLock,
                  lockReason: rawProj.lockReason,
                  checkpoints: [],
                } as Project;
              }

              if (!seenIds.has(proj.id)) {
                seenIds.add(proj.id);
                matchedProjects.push(proj);
              }
            }

            filtered = matchedProjects;
          } else {
            // --- OLD BEHAVIOUR (for packs without `projects`, e.g. scanned packs) ---
            const packItems: string[] = Array.isArray(packDef?.items)
              ? packDef.items.map((it: any) => String(it || "").toLowerCase())
              : [];
            const packKeywords = (getPackKeywords(selPack) || []).map((k: any) =>
              String(k || "").toLowerCase()
            );

            // If packDef exists and items are present -> map each item to a project (NOT show the pack object)
            if (packDef && packItems.length > 0) {
              const matchedProjects: Project[] = [];
              const seenIds = new Set<string>();

              const tryPush = (proj?: Project) => {
                if (!proj || !proj.id) return;
                if (seenIds.has(proj.id)) return;
                seenIds.add(proj.id);
                matchedProjects.push(proj);
              };

              console.groupCollapsed(
                `[ProjectSelection] pack '${selPack}' items matching debug`
              );
              for (const itemRaw of packItems) {
                const item = String(itemRaw || "").trim().toLowerCase();
                let found: Project | undefined = undefined;

                // 1) exact id match
                found = enriched.find((p) => normalize(p.id) === item);
                if (found) {
                  console.debug(`item='${item}' → exact id '${found.id}'`);
                  tryPush(found);
                  continue;
                }

                // 2) id contains item
                found = enriched.find((p) => normalize(p.id).includes(item));
                if (found) {
                  console.debug(`item='${item}' → id contains '${found.id}'`);
                  tryPush(found);
                  continue;
                }

                // 3) name contains item
                found = enriched.find((p) => normalize(p.name).includes(item));
                if (found) {
                  console.debug(`item='${item}' → name contains '${found.id}'`);
                  tryPush(found);
                  continue;
                }

                // 4) subtitle contains item
                found = enriched.find((p) => normalize(p.subtitle).includes(item));
                if (found) {
                  console.debug(`item='${item}' → subtitle contains '${found.id}'`);
                  tryPush(found);
                  continue;
                }

                // 5) pack keywords — try to match a project via keywords
                if (packKeywords.includes(item)) {
                  const byKw = enriched.find((p) => {
                    const id = normalize(p.id);
                    const name = normalize(p.name);
                    const subtitle = normalize(p.subtitle);
                    return id.includes(item) || name.includes(item) || subtitle.includes(item);
                  });
                  if (byKw) {
                    console.debug(
                      `item='${item}' → matched by pack keyword to project '${byKw.id}'`
                    );
                    tryPush(byKw);
                    continue;
                  }
                }

                // 6) broader keyword match: try any pack keyword
                let broader: Project | undefined = undefined;
                for (const kw of packKeywords) {
                  const candidate = enriched.find((p) => {
                    const id = normalize(p.id);
                    const name = normalize(p.name);
                    const subtitle = normalize(p.subtitle);
                    return (
                      id.includes(kw) || name.includes(kw) || subtitle.includes(kw)
                    );
                  });
                  if (candidate) {
                    broader = candidate;
                    console.debug(
                      `item='${item}' → fallback matched by pack keyword '${kw}' → project '${candidate.id}'`
                    );
                    break;
                  }
                }
                if (broader) {
                  tryPush(broader);
                  continue;
                }

                console.debug(`item='${item}' → NO project matched`);
              }
              console.groupEnd();

              if (matchedProjects.length > 0) {
                filtered = matchedProjects;
              } else {
                const keywordsFallback =
                  packKeywords.length > 0
                    ? packKeywords
                    : (getPackKeywords(selPack) || []).map((k: any) =>
                        String(k || "").toLowerCase()
                      );
                if (keywordsFallback.length > 0) {
                  filtered = enriched.filter((proj) => {
                    const id = normalize(proj.id);
                    const name = normalize(proj.name);
                    const subtitle = normalize(proj.subtitle);
                    return keywordsFallback.some(
                      (kw) =>
                        id.includes(kw) || name.includes(kw) || subtitle.includes(kw)
                    );
                  });
                } else {
                  filtered = enriched.filter(
                    (proj) => String(proj.id) === String(selPack)
                  );
                }
              }
            } else {
              // No packDef or no items -> fallback to keyword-based filtering or scanned-pack id fallback
              const keywordsFallback = (getPackKeywords(selPack) || []).map((k: any) =>
                String(k || "").toLowerCase()
              );
              if (keywordsFallback.length > 0) {
                filtered = enriched.filter((proj) => {
                  const id = normalize(proj.id);
                  const name = normalize(proj.name);
                  const subtitle = normalize(proj.subtitle);
                  return keywordsFallback.some(
                    (kw) => id.includes(kw) || name.includes(kw) || subtitle.includes(kw)
                  );
                });
              } else {
                filtered = enriched.filter(
                  (proj) => String(proj.id) === String(selPack)
                );
              }
            }
          }
        }

        setDisplayProjects(filtered);
      } catch (err) {
        console.warn("ProjectSelection error:", err);
        setDisplayProjects((getAllProjects() || []) as Project[]);
      } finally {
        setLoading(false);
      }
    })();
    // re-run when param changes
  }, [paramPackId]);

  // initialize sessions for shown projects
  useEffect(() => {
    (async () => {
      try {
        await Promise.all((displayProjects || []).map((p) => initSession(p.id)));
      } catch {
        // ignore
      }
    })();
  }, [displayProjects]);

  return (
    <div className="min-h-screen bg-page-light dark:bg-page-dark transition-colors duration-300">
      <Header view={view} setView={setView} dir="rtl">
        <IconViewToggle view={view} setView={setView} />
      </Header>

      <main className="p-4 sm:p-6 lg:p-8 max-w-5xl mx-auto">
        {loading ? (
          <div className="py-20 text-center text-neutral-500">در حال بارگذاری...</div>
        ) : selectedPackId && displayProjects.length === 0 ? (
          <div className="py-12 text-center">
            <h2 className="text-2xl font-semibold">هیچ پروژه‌ای در این پَک یافت نشد</h2>
            <p className="mt-2 text-neutral-500">
              ممکن است هنوز پروژه‌ای به این پَک اضافه نشده باشد.
            </p>
          </div>
        ) : view === "list" ? (
          <ProjectListNew projects={displayProjects} onOpen={(p) => setOpenProject(p)} />
        ) : (
          <EmblaIOSCarousel projects={displayProjects} onOpen={(p) => setOpenProject(p)} />
        )}
      </main>

      {openProject && (
        <ProjectActionSheet project={openProject} onClose={() => setOpenProject(null)} />
      )}
    </div>
  );
};

export default ProjectSelection;
