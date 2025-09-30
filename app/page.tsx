"use client";

import React, { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { PieChart, Pie, Cell, Tooltip } from "recharts";
import { Plus, Check, Pencil, Trash2, ChevronRight } from "lucide-react";
import { dataService } from "../lib/dataService";
import { MigrationService } from "../lib/migrationService";

// --- Types ---
type Category = {
  id: string;
  name: string;
  color: string;
  goalPct?: number; // optional share-of-time goal for the selected range
  icon?: string; // emoji for simplicity
  parentId?: string | null; // null/undefined = top-level
};

type Session = {
  id: string;
  categoryId: string; // can be a subcategory id or a top-level id
  start: number; // ms
  end?: number; // ms, undefined while running
};

type Range = "Today" | "Week" | "Month" | "Year" | "All";
type Page = "Time" | "Home" | "Vision";

type VisionPhoto = { id: string; src: string; alt: string };
type Goal = { 
  id: string; 
  text: string; 
  categoryId: string; 
  completed?: boolean; 
  createdAt: number;
  totalSeconds?: number;
  isActive?: boolean;
  lastStartTime?: number;
};

// --- Helpers ---
const uid = () => Math.random().toString(36).slice(2);

// Show at most two highest non-zero units; includes years and days when large
function formatHMS(totalSeconds: number) {
  let s = Math.max(0, Math.floor(totalSeconds));
  const YEAR = 365 * 24 * 3600;
  const DAY = 24 * 3600;
  const HOUR = 3600;
  const MIN = 60;

  const years = Math.floor(s / YEAR); s -= years * YEAR;
  const days = Math.floor(s / DAY); s -= days * DAY;
  const hours = Math.floor(s / HOUR); s -= hours * HOUR;
  const mins = Math.floor(s / MIN);
  const secs = s % MIN;

  const parts: string[] = [];
  if (years) parts.push(`${years} yr${years === 1 ? "" : "s"}`);
  if (days) parts.push(`${days} day${days === 1 ? "" : "s"}`);
  if (!parts.length && hours) parts.push(`${hours} hr${hours === 1 ? "" : "s"}`);
  if (!parts.length && !hours && mins) parts.push(`${mins} min`);

  // second part
  if (parts[0]?.includes("yr") || parts[0]?.includes("day")) {
    if (days && !parts[0].includes("day")) parts.push(`${days} day${days === 1 ? "" : "s"}`);
    else if (hours) parts.push(`${hours} hr${hours === 1 ? "" : "s"}`);
  } else if (hours) {
    parts.push(`${mins} min`);
  } else if (mins) {
    parts.push(`${secs} sec`);
  } else {
    parts.push(`${secs} sec`);
  }
  return parts.join(" ");
}

function truncateText(text: string, maxLength: number = 18): string {
  if (text.length <= maxLength) return text;
  return text.substring(0, 16) + "..";
}

function startOfDay(d = new Date()) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}
function startOfWeek(d = new Date()) {
  const day = d.getDay(); // 0 Sun .. 6 Sat
  const diff = (day + 6) % 7; // start week on Monday
  const s = new Date(d);
  s.setDate(d.getDate() - diff);
  s.setHours(0, 0, 0, 0);
  return s.getTime();
}
function startOfMonth(d = new Date()) {
  return new Date(d.getFullYear(), d.getMonth(), 1).getTime();
}
function startOfYear(d = new Date()) {
  return new Date(d.getFullYear(), 0, 1).getTime();
}

function rangeBounds(range: Range): { start: number; end: number } {
  const now = Date.now();
  switch (range) {
    case "Today":
      return { start: startOfDay(new Date(now)), end: now };
    case "Week":
      return { start: startOfWeek(new Date(now)), end: now };
    case "Month":
      return { start: startOfMonth(new Date(now)), end: now };
    case "Year":
      return { start: startOfYear(new Date(now)), end: now };
    case "All":
    default:
      return { start: 0, end: now };
  }
}

function overlapMs(aStart: number, aEnd: number, bStart: number, bEnd: number) {
  const start = Math.max(aStart, bStart);
  const end = Math.min(aEnd, bEnd);
  return Math.max(0, end - start);
}

// Build a parent->children adjacency map
function buildChildMap(categories: Category[]) {
  const map: Record<string, string[]> = {};
  for (const c of categories) {
    const key = c.parentId ?? "__root__";
    if (!map[key]) map[key] = [];
    map[key].push(c.id);
  }
  return map;
}

// Compute direct (non-rolled-up) seconds for each category in a window
function computeDirectSeconds(
  sessions: Session[],
  windowStart: number,
  windowEnd: number,
  goals?: Goal[]
): Record<string, number> {
  const totals: Record<string, number> = {};
  
  // Add session times
  for (const s of sessions) {
    const end = s.end ?? Date.now();
    const ms = overlapMs(s.start, end, windowStart, windowEnd);
    if (ms > 0) totals[s.categoryId] = (totals[s.categoryId] ?? 0) + ms / 1000;
  }
  
  // Add goal times
  if (goals) {
    for (const g of goals) {
      // Calculate current elapsed time for active goals
      const currentElapsed = g.isActive && g.lastStartTime 
        ? Math.floor((Date.now() - g.lastStartTime) / 1000)
        : 0;
      const totalSeconds = (g.totalSeconds || 0) + currentElapsed;
      
      if (totalSeconds > 0) {
        totals[g.categoryId] = (totals[g.categoryId] ?? 0) + totalSeconds;
      }
    }
  }
  
  return totals;
}

// Roll up seconds to include descendants for each category id
function rollupSeconds(
  categories: Category[],
  direct: Record<string, number>
): Record<string, number> {
  const childMap = buildChildMap(categories);
  const memo: Record<string, number> = {};
  const ids = new Set(categories.map((c) => c.id));

  function dfs(id: string): number {
    if (memo[id] != null) return memo[id];
    let total = direct[id] ?? 0;
    const kids = childMap[id] ?? [];
    for (const k of kids) total += dfs(k);
    memo[id] = total;
    return total;
  }

  ids.forEach(id => dfs(id));
  return memo;
}

function isLeaf(categories: Category[], id: string) {
  return !categories.some((c) => c.parentId === id);
}

function clampPercent(n: number) {
  return Math.max(0, Math.min(100, Math.round(n)));
}

function sanitizeGoalInput(value: string): string {
  const digits = value.replace(/[^0-9]/g, "");
  if (digits === "") return "";
  return String(clampPercent(Number(digits)));
}

const STORAGE_KEY = "time-tracker-mvp-v11"; // bump for Vision persistence
const PREFS_KEY = "time-tracker-prefs-v2"; // only preferredRange now

// --- Seed data ---
const DEFAULT_CATEGORIES: Category[] = [
  { id: "family", name: "Family", color: "#6366F1", goalPct: 60, icon: "👨‍👩‍👧" },
  { id: "career", name: "Career", color: "#22C55E", goalPct: 30, icon: "💼" },
  { id: "fun", name: "Fun", color: "#F97316", goalPct: 10, icon: "🎮" },
];

const DEFAULT_VISION: VisionPhoto[] = [
  // First 4 photos (hidden grid - indices 0-3) - using duplicates of working photos
  { id: uid(), src: "https://images.unsplash.com/photo-1496302662116-35cc4f36df92?auto=format&fit=crop&w=800&q=60", alt: "Financial freedom" },
  { id: uid(), src: "https://images.unsplash.com/photo-1496302662116-35cc4f36df92?auto=format&fit=crop&w=800&q=60", alt: "Financial freedom" },
  { id: uid(), src: "https://images.unsplash.com/photo-1517836357463-d25dfeac3438?auto=format&fit=crop&w=800&q=60", alt: "Healthy strong body" },
  { id: uid(), src: "https://images.unsplash.com/photo-1469474968028-56623f02e42e?auto=format&fit=crop&w=800&q=60", alt: "Adventure and travel" },
  // Second 4 photos (visible grid - indices 4-7)
  { id: uid(), src: "https://images.unsplash.com/photo-1496302662116-35cc4f36df92?auto=format&fit=crop&w=800&q=60", alt: "Financial freedom" },
  { id: uid(), src: "https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?auto=format&fit=crop&w=800&q=60", alt: "Dream home" },
  { id: uid(), src: "https://images.unsplash.com/photo-1517836357463-d25dfeac3438?auto=format&fit=crop&w=800&q=60", alt: "Healthy strong body" },
  { id: uid(), src: "https://images.unsplash.com/photo-1469474968028-56623f02e42e?auto=format&fit=crop&w=800&q=60", alt: "Adventure and travel" },
];

// --- Self-tests (dev) ---
function runSelfTests() {
  // formatHMS basic
  console.assert(formatHMS(0).includes("0 sec"), "formatHMS 0 failed");
  console.assert(formatHMS(65).includes("1 min"), "formatHMS 65 failed");
  // big units
  console.assert(formatHMS(26 * 3600).includes("1 day"), "formatHMS day failed");
  console.assert(formatHMS(400 * 24 * 3600).includes("1 yr"), "formatHMS year failed");

  // overlapMs
  const ms = overlapMs(0, 1000, 500, 1500);
  console.assert(ms === 500, `overlapMs failed: ${ms}`);
  // non-overlap
  const ms0 = overlapMs(0, 1000, 1000, 2000);
  console.assert(ms0 === 0, `overlapMs non-overlap failed: ${ms0}`);

  // hierarchy roll-up test
  const cats: Category[] = [
    { id: "p", name: "Parent", color: "#000000" },
    { id: "c1", name: "Child1", color: "#000000", parentId: "p" },
  ];
  const sessions: Session[] = [
    { id: "s1", categoryId: "c1", start: 0, end: 10_000 }, // 10 sec
    { id: "s2", categoryId: "c1", start: 20_000, end: 40_000 }, // 20 sec
  ];
  const direct = computeDirectSeconds(sessions, 0, 60_000);
  const rolled = rollupSeconds(cats, direct);
  console.assert(direct["c1"] === 30, `direct child wrong: ${direct["c1"]}`);
  console.assert(rolled["p"] === 30, `rollup parent wrong: ${rolled["p"]}`);
  console.assert(isLeaf(cats, "c1") === true && isLeaf(cats, "p") === false, "isLeaf failed");

  // random color sanity
  const sample = randomColor();
  console.assert(/^#[0-9A-Fa-f]{6}$/.test(sample), `randomColor hex failed: ${sample}`);

  // CSV newline test
  const rows = [["a","b"],["c","d"]];
  const csv = rows.map(r => r.map(v => `"${v}"`).join(",")).join("\n");
  console.assert(csv.includes("\n"), "CSV newline join failed");

  // sanitizeGoalInput
  console.assert(sanitizeGoalInput("90a") === "90", "sanitize digits failed");
  console.assert(sanitizeGoalInput("101") === "100", "sanitize clamp failed");
  console.assert(sanitizeGoalInput("") === "", "sanitize empty failed");
  console.assert(sanitizeGoalInput("000") === "0", "sanitize zeros failed");

  // sub-goal helpers
  const testCats: Category[] = [
    { id: "p", name: "Parent", color: "#000" },
    { id: "c1", name: "c1", color: "#000", parentId: "p", goalPct: 60 },
    { id: "c2", name: "c2", color: "#000", parentId: "p", goalPct: 40 },
  ];
  console.assert(computeChildGoalSum(testCats, "p") === 100, "child sum 100 failed");
  console.assert(computeChildGoalSum(testCats, "p", { id: "c2", goal: 50 }) === 110, "child sum override failed");
  console.assert(computeChildGoalSum(testCats, "p", { goal: 20 }) === 120, "child sum add new failed");

  // root goal helpers
  const rootCats: Category[] = [
    { id: "r1", name: "A", color: "#000", goalPct: 50 },
    { id: "r2", name: "B", color: "#000", goalPct: 50 },
  ];
  console.assert(computeRootGoalSum(rootCats) === 100, "root sum 100 failed");
  console.assert(computeRootGoalSum(rootCats, { id: "r2", goal: 40 }) === 90, "root override failed");
  console.assert(computeRootGoalSum(rootCats, { goal: 30 }) === 130, "root add new failed");

  // new extra tests
  console.assert(sanitizeGoalInput("005") === "5", "sanitize leading zeros failed");
  const soloLeaf: Category[] = [{ id: "x", name: "Solo", color: "#000" }];
  console.assert(isLeaf(soloLeaf, "x") === true, "isLeaf solo failed");
}

function computeChildGoalSum(categories: Category[], parentId: string, override?: { id?: string; goal?: number }) {
  let sum = 0;
  for (const c of categories) {
    if (c.parentId === parentId) {
      const val = (override && override.id === c.id)
        ? (override.goal ?? 0)
        : (c.goalPct ?? 0);
      sum += val;
    }
  }
  if (override && override.id && !categories.some(c => c.id === override.id)) {
    // adding a new child case (no existing id under parent)
    sum += override.goal ?? 0;
  }
  if (override && !override.id) {
    // explicitly adding new child without id
    sum += override.goal ?? 0;
  }
  return sum;
}

function computeRootGoalSum(categories: Category[], override?: { id?: string; goal?: number }) {
  let sum = 0;
  for (const c of categories) {
    if (c.parentId == null) {
      const val = (override && override.id === c.id)
        ? (override.goal ?? 0)
        : (c.goalPct ?? 0);
      sum += val;
    }
  }
  if (override && !override.id) sum += override.goal ?? 0; // adding a new root cat
  if (override && override.id && !categories.some(c => c.id === override.id && c.parentId == null)) sum += override.goal ?? 0;
  return sum;
}

function getCategory(categories: Category[], id: string | null | undefined) {
  if (!id) return undefined;
  return categories.find(c => c.id === id);
}
function getCategoryColor(categories: Category[], id: string | null | undefined) {
  return getCategory(categories, id)?.color ?? "#6b7280";
}
function getCategoryPathName(categories: Category[], id: string) {
  const cat = categories.find(c=>c.id===id);
  if (!cat) return id;
  if (cat.parentId) {
    const p = categories.find(c=>c.id===cat.parentId);
    return `${p?.name ?? "?"} › ${cat.name}`;
  }
  return cat.name;
}

// Simple pleasant random color for new categories
function randomColor() {
  const palette = [
    "#60A5FA", // blue
    "#8B5CF6", // violet
    "#F472B6", // pink
    "#F59E0B", // amber
    "#10B981", // emerald
    "#EF4444", // red
    "#14B8A6", // teal
    "#A78BFA", // indigo-light
  ];
  return palette[Math.floor(Math.random() * palette.length)];
}

// Generate different shades of a color for subcategories
function generateColorShade(baseColor: string, shadeIndex: number): string {
  // Convert hex to RGB
  const hex = baseColor.replace('#', '');
  const r = parseInt(hex.substr(0, 2), 16);
  const g = parseInt(hex.substr(2, 2), 16);
  const b = parseInt(hex.substr(4, 2), 16);
  
  // Define shade variations - simple multiplier approach
  const multipliers = [0.6, 0.8, 1.0, 1.2, 1.4, 1.6, 1.8]; // Darker to lighter with 20% differences
  const multiplier = multipliers[shadeIndex % multipliers.length];
  
  // Apply multiplier to each RGB component
  const newR = Math.min(255, Math.round(r * multiplier));
  const newG = Math.min(255, Math.round(g * multiplier));
  const newB = Math.min(255, Math.round(b * multiplier));
  
  // Convert back to hex
  const toHex = (n: number) => n.toString(16).padStart(2, '0');
  return `#${toHex(newR)}${toHex(newG)}${toHex(newB)}`;
}

function useElementSize<T extends HTMLElement>() {
  const ref = useRef<T | null>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    const node = ref.current;
    if (!node || typeof window === "undefined" || typeof ResizeObserver === "undefined") {
      return;
    }

    const updateSize = () => {
      const rect = node.getBoundingClientRect();
      setSize((prev) => {
        const next = { width: rect.width, height: rect.height };
        return prev.width === next.width && prev.height === next.height ? prev : next;
      });
    };

    updateSize();

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        if (entry.target === node) {
          const { width, height } = entry.contentRect;
          setSize((prev) => {
            const next = { width, height };
            return prev.width === next.width && prev.height === next.height ? prev : next;
          });
        }
      }
    });

    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return [ref, size] as const;
}

// VisionPage component - defined outside to prevent re-creation on timer updates
function VisionPage({ 
  categories, 
  goals, 
  visionPhotos, 
  setGoals, 
  setVisionPhotos, 
  addCategory,
  isAuthenticated,
  stopAllActiveTimers
}: {
  categories: Category[];
  goals: Goal[];
  visionPhotos: VisionPhoto[];
  setGoals: (fn: (prev: Goal[]) => Goal[]) => void;
  setVisionPhotos: (fn: (prev: VisionPhoto[]) => VisionPhoto[]) => void;
  addCategory: (cat: { name: string; goalPct?: number; color: string; parentId: string | null }) => void;
  isAuthenticated: boolean;
  stopAllActiveTimers: () => Promise<void>;
}) {
  const [goalText, setGoalText] = useState("");
  const [selCat, setSelCat] = useState<string | "">("");
  const [selSub, setSelSub] = useState<string | "">("");
  const [editingGoal, setEditingGoal] = useState<string | null>(null);
  const [editingText, setEditingText] = useState("");
  const [editingCat, setEditingCat] = useState<string>("");
  const [editingSub, setEditingSub] = useState<string>("");
  const [editingImage, setEditingImage] = useState<number | null>(null);
  const [editingImageText, setEditingImageText] = useState("");

  const subcats = useMemo(() => categories.filter(c => c.parentId === (selCat || null)), [categories, selCat]);
  const editingSubcats = useMemo(() => categories.filter(c => c.parentId === (editingCat || null)), [categories, editingCat]);

  function onUpload(idx: number, file: File) {
    const reader = new FileReader();
    reader.onload = async () => {
      const result = typeof reader.result === "string" ? reader.result : null;
      if (!result) return;
      
      if (isAuthenticated) {
        try {
          const photo = visionPhotos[idx];
          if (photo) {
            await dataService.updateVisionPhoto(photo.id, {
              src: result,
              alt: file.name || photo.alt
            });
            
            // Manually refresh vision photos
            const photosData = await dataService.getVisionPhotos();
            setVisionPhotos(() => photosData.map(v => ({
              id: v.id,
              src: v.src,
              alt: v.alt
            })));
          }
        } catch (error) {
          console.error("Error uploading vision photo:", error);
          alert("Failed to upload image. Please try again.");
        }
      } else {
        setVisionPhotos(prev => prev.map((p, i) => (
          i === idx
            ? { ...p, src: result, alt: file.name || p.alt }
            : p
        )));
      }
    };
    reader.onerror = () => {
      console.error("Failed to read image file");
    };
    reader.readAsDataURL(file);
  }

  function createNewRoot() {
    const name = prompt("New category name?")?.trim();
    if (!name) return;
    addCategory({ name, color: randomColor(), parentId: null });
    const created = categories.find(c => c.name === name && c.parentId == null);
    if (created) setSelCat(created.id);
  }
  function createNewSub() {
    if (!selCat) { alert("Pick a parent category first."); return; }
    const name = prompt("New subcategory name?")?.trim();
    if (!name) return;
    const parentColor = getCategoryColor(categories, selCat);
    addCategory({ name, color: parentColor, parentId: selCat });
    const created = categories.find(c => c.name === name && c.parentId === selCat);
    if (created) setSelSub(created.id);
  }

  async function saveGoal() {
    const text = goalText.trim();
    const target = selSub || selCat;
    if (!text) return;
    if (!target) { alert("Choose where to save this goal."); return; }
    
    if (isAuthenticated) {
      try {
        await dataService.createGoal({
          text,
          category_id: target,
          completed: false
        });
        
        // Manually refresh goals
        const goalsData = await dataService.getGoals();
        setGoals(() => goalsData.map(g => ({
          id: g.id,
          text: g.text,
          categoryId: g.category_id,
          completed: g.completed,
          createdAt: new Date(g.created_at).getTime()
        })));
        setGoalText("");
      } catch (error) {
        console.error("Error creating goal:", error);
        alert("Failed to create goal. Please try again.");
      }
    } else {
      const g: Goal = { id: uid(), text, categoryId: target, completed: false, createdAt: Date.now() };
      setGoals(prev => [g, ...prev]);
      setGoalText("");
    }
  }

  async function toggleGoalTimer(id: string) {
    const goal = goals.find(g => g.id === id);
    if (!goal || goal.completed) return; // Can't toggle timer on completed goals
    
    // Stop ALL active timers first (both sessions and goals)
    await stopAllActiveTimers();
    
    if (isAuthenticated) {
      try {
        // Since we already stopped all timers, just start this goal timer
        await dataService.updateGoal(id, {
          is_active: true,
          last_start_time: new Date().toISOString()
        });
        
        // Manually refresh goals
        const goalsData = await dataService.getGoals();
        setGoals(() => goalsData.map(g => ({
          id: g.id,
          text: g.text,
          categoryId: g.category_id,
          completed: g.completed,
          createdAt: new Date(g.created_at).getTime(),
          totalSeconds: g.total_seconds || 0,
          isActive: g.is_active || false,
          lastStartTime: g.last_start_time ? new Date(g.last_start_time).getTime() : undefined
        })));
      } catch (error) {
        console.error("Error toggling goal timer:", error);
        alert("Failed to update goal timer. Please try again.");
      }
    } else {
      // Local state for unauthenticated users - since we already stopped all timers, just start this goal
      setGoals(prev => prev.map(g => {
        if (g.id === id) {
          return { ...g, isActive: true, lastStartTime: Date.now() };
        }
        return g;
      }));
    }
  }

  async function toggleGoalCompletion(id: string) {
    const goal = goals.find(g => g.id === id);
    if (!goal) return;
    
    if (isAuthenticated) {
      try {
        // If marking as complete and timer is running, stop it first
        let finalTotalSeconds = goal.totalSeconds || 0;
        if (!goal.completed && goal.isActive && goal.lastStartTime) {
          const sessionSeconds = Math.floor((Date.now() - goal.lastStartTime) / 1000);
          finalTotalSeconds += sessionSeconds;
        }
        
        await dataService.updateGoal(id, {
          completed: !goal.completed,
          is_active: false,
          total_seconds: finalTotalSeconds,
          last_start_time: null
        });
        
        // Manually refresh goals
        const goalsData = await dataService.getGoals();
        setGoals(() => goalsData.map(g => ({
          id: g.id,
          text: g.text,
          categoryId: g.category_id,
          completed: g.completed,
          createdAt: new Date(g.created_at).getTime(),
          totalSeconds: g.total_seconds || 0,
          isActive: g.is_active || false,
          lastStartTime: g.last_start_time ? new Date(g.last_start_time).getTime() : undefined
        })));
      } catch (error) {
        console.error("Error toggling goal completion:", error);
        alert("Failed to update goal. Please try again.");
      }
    } else {
      setGoals(prev => prev.map(g => g.id === id ? { ...g, completed: !g.completed, isActive: false } : g));
    }
  }

  function updateGoal(id: string, newText: string) {
    setGoals(prev => prev.map(g => g.id === id ? { ...g, text: newText } : g));
  }

  function startEditing(goal: Goal) {
    setEditingGoal(goal.id);
    setEditingText(goal.text);
    
    // Find the goal's current category and subcategory
    const currentCategory = categories.find(c => c.id === goal.categoryId);
    if (currentCategory) {
      if (currentCategory.parentId === null) {
        // It's a root category
        setEditingCat(currentCategory.id);
        setEditingSub("");
      } else {
        // It's a subcategory
        setEditingCat(currentCategory.parentId || "");
        setEditingSub(currentCategory.id);
      }
    }
  }

  async function saveEditing() {
    if (editingGoal && editingText.trim()) {
      const targetCategory = editingSub || editingCat;
      if (targetCategory) {
        if (isAuthenticated) {
          try {
            await dataService.updateGoal(editingGoal, {
              text: editingText.trim(),
              category_id: targetCategory
            });
            
            // Manually refresh goals
            const goalsData = await dataService.getGoals();
            setGoals(() => goalsData.map(g => ({
              id: g.id,
              text: g.text,
              categoryId: g.category_id,
              completed: g.completed,
              createdAt: new Date(g.created_at).getTime()
            })));
          } catch (error) {
            console.error("Error updating goal:", error);
            alert("Failed to update goal. Please try again.");
          }
        } else {
          setGoals(prev => prev.map(g => 
            g.id === editingGoal 
              ? { ...g, text: editingText.trim(), categoryId: targetCategory }
              : g
          ));
        }
      }
    }
    setEditingGoal(null);
    setEditingText("");
    setEditingCat("");
    setEditingSub("");
  }

  function cancelEditing() {
    setEditingGoal(null);
    setEditingText("");
    setEditingCat("");
    setEditingSub("");
  }

  async function deleteGoal(id: string) {
    if (confirm("Are you sure you want to delete this goal?")) {
      if (isAuthenticated) {
        try {
          await dataService.deleteGoal(id);
          
          // Manually refresh goals
          const goalsData = await dataService.getGoals();
          setGoals(() => goalsData.map(g => ({
            id: g.id,
            text: g.text,
            categoryId: g.category_id,
            completed: g.completed,
            createdAt: new Date(g.created_at).getTime(),
            totalSeconds: g.total_seconds || 0,
            isActive: g.is_active || false,
            lastStartTime: g.last_start_time ? new Date(g.last_start_time).getTime() : undefined
          })));
        } catch (error) {
          console.error("Error deleting goal:", error);
          alert("Failed to delete goal. Please try again.");
        }
      } else {
        setGoals(prev => prev.filter(g => g.id !== id));
      }
    }
  }

  function startEditingImage(idx: number, currentText: string) {
    setEditingImage(idx);
    setEditingImageText(currentText);
  }

  async function saveImageText() {
    if (editingImage !== null) {
      if (isAuthenticated) {
        try {
          const photo = visionPhotos[editingImage];
          if (photo) {
            await dataService.updateVisionPhoto(photo.id, {
              alt: editingImageText.trim()
            });
            
            // Manually refresh vision photos
            const photosData = await dataService.getVisionPhotos();
            setVisionPhotos(() => photosData.map(v => ({
              id: v.id,
              src: v.src,
              alt: v.alt
            })));
          }
        } catch (error) {
          console.error("Error updating vision photo:", error);
          alert("Failed to update image text. Please try again.");
        }
      } else {
        setVisionPhotos(prev => prev.map((p, i) => 
          i === editingImage 
            ? { ...p, alt: editingImageText.trim() }
            : p
        ));
      }
    }
    setEditingImage(null);
    setEditingImageText("");
  }

  function cancelImageEditing() {
    setEditingImage(null);
    setEditingImageText("");
  }

  const pending = goals.filter(g => !g.completed);
  const done = goals.filter(g => g.completed);

  return (
    <div className="px-5 mt-6 flex-1">
      <div className="max-w-3xl mx-auto space-y-5">
        {/* First grid of photos (hidden - indices 0-3) */}
        <div className="hidden">
          <div className="grid grid-cols-2 gap-4">
            {visionPhotos.slice(0, 4).map((p, idx) => (
              <div key={`hidden-${p.id}`} className="relative bg-[#161925] border border-[#1f2337] rounded-2xl overflow-hidden">
                <div className="aspect-square overflow-hidden">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={p.src} alt={p.alt} className="w-full h-full object-cover" />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Second grid of photos (visible - indices 4-7) */}
        <div className="grid grid-cols-2 gap-4">
          {visionPhotos.slice(4, 8).map((p, idx) => {
            const actualIdx = idx + 4; // Map to actual index 4-7
            return (
            <div key={p.id} className="relative bg-[#161925] border border-[#1f2337] rounded-2xl overflow-hidden">
              <div className="aspect-square overflow-hidden">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={p.src} alt={p.alt} className="w-full h-full object-cover" />
              </div>
              
              {editingImage === actualIdx ? (
                <div className="p-2 bg-[#0f1117] border-t border-[#1f2337] space-y-2">
                  <input
                    type="text"
                    value={editingImageText}
                    onChange={(e) => setEditingImageText(e.target.value)}
                    className="w-full px-2 py-1 text-xs bg-[#0b0e15] border border-[#2a2f45] rounded-lg focus:outline-none"
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') saveImageText();
                      if (e.key === 'Escape') cancelImageEditing();
                    }}
                  />
                  <div className="flex gap-1">
                    <button 
                      onClick={saveImageText}
                      className="text-xs px-2 py-1 bg-green-600 hover:bg-green-700 rounded transition-colors"
                    >
                      Save
                    </button>
                    <button 
                      onClick={cancelImageEditing}
                      className="text-xs px-2 py-1 bg-gray-600 hover:bg-gray-700 rounded transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div 
                  className="p-2 text-center text-xs opacity-80 bg-[#0f1117] border-t border-[#1f2337] cursor-pointer hover:opacity-100 transition-opacity"
                  onClick={() => startEditingImage(actualIdx, p.alt)}
                  title="Click to edit"
                >
                  {p.alt}
                </div>
              )}
              
              <label className="absolute right-2 top-2 text-xs px-2 py-1 rounded-lg bg-[#0f1117]/80 border border-[#2a2f45] cursor-pointer hover:border-white/50">
                Upload
                <input type="file" accept="image/*" className="hidden" onChange={(e)=>{ const f=e.target.files?.[0]; if (f) onUpload(actualIdx, f); }} />
              </label>
            </div>
          )})}
        </div>

        {/* Middle panel: "computer screen" with goal entry */}
        <div className="rounded-2xl border border-[#1f2337] bg-[#0f1117] shadow-inner p-4">
          <div className="mb-2 text-sm opacity-80">Vision Goal</div>
          <textarea
            value={goalText}
            onChange={(e)=>setGoalText(e.target.value)}
            placeholder="Write Goal Here"
            className="w-full h-24 resize-vertical px-3 py-2 rounded-xl bg-[#0b0e15] border border-[#2a2f45] focus:outline-none"
          />

          <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <div className="text-xs opacity-70 mb-1">Save to Category</div>
              <select
                value={selCat}
                onChange={(e)=>{ setSelCat(e.target.value); setSelSub(""); }}
                className="w-full px-3 py-2 rounded-xl bg-[#0b0e15] border border-[#2a2f45]"
              >
                <option value="">— choose —</option>
                {categories.filter(c=>c.parentId==null).map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
              <button onClick={createNewRoot} className="mt-2 text-xs px-2 py-1 rounded-lg border border-[#2a2f45] bg-[#0f1117] hover:border-white/50">+ New Category</button>
            </div>
            <div>
              <div className="text-xs opacity-70 mb-1">Or Subcategory</div>
              <select
                value={selSub}
                onChange={(e)=>setSelSub(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-[#0b0e15] border border-[#2a2f45]"
                disabled={!selCat}
              >
                <option value="">— optional —</option>
                {subcats.map(sc => (
                  <option key={sc.id} value={sc.id}>{sc.name}</option>
                ))}
              </select>
              <button onClick={createNewSub} className="mt-2 text-xs px-2 py-1 rounded-lg border border-[#2a2f45] bg-[#0f1117] hover:border-white/50" disabled={!selCat}>+ New Subcategory</button>
            </div>
          </div>
          <div className="mt-3 flex items-center gap-2">
            <button onClick={saveGoal} className="px-3 py-2 rounded-xl border border-[#2a2f45] bg-white text-black">Save</button>
            <div className="text-xs opacity-60">Saved under: {selSub ? getCategoryPathName(categories, selSub) : (selCat ? getCategoryPathName(categories, selCat) : "—")}</div>
          </div>

          {/* Pending goals */}
          {pending.length > 0 && (
            <div className="mt-4">
              <div className="text-sm font-semibold mb-2">In Progress</div>
              <div className="space-y-2">
                {pending.map(g => {
                  const color = getCategoryColor(categories, g.categoryId);
                  const name = getCategoryPathName(categories, g.categoryId);
                  const isEditing = editingGoal === g.id;
                  
                  const isRunning = g.isActive && !g.completed;
                  const currentElapsed = g.lastStartTime 
                    ? Math.floor((Date.now() - g.lastStartTime) / 1000)
                    : 0;
                  const totalElapsed = (g.totalSeconds || 0) + currentElapsed;
                  const highlight = isRunning ? `${color}33` : undefined; // Tint active goal like categories
                  
                  return (
                    <div 
                      key={g.id} 
                      className={`flex items-center gap-2 p-3 rounded-xl border ${isRunning ? 'border-blue-500' : 'border-[#1f2337]'}`}
                      style={{ background: highlight || '#0b0e15' }}
                    >
                      <button 
                        onClick={()=>toggleGoalCompletion(g.id)} 
                        className={`w-5 h-5 rounded-full border hover:opacity-80 transition-opacity flex-shrink-0`}
                        style={{ borderColor: color, background: g.completed ? color : 'transparent' }} 
                        title={g.completed ? "Mark incomplete" : "Mark complete"} 
                      />
                      
                      {isEditing ? (
                        <div className="flex-1 space-y-2">
                          <input
                            type="text"
                            value={editingText}
                            onChange={(e) => setEditingText(e.target.value)}
                            className="w-full px-2 py-1 text-sm bg-[#0b0e15] border border-[#2a2f45] rounded-lg focus:outline-none"
                            autoFocus
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') saveEditing();
                              if (e.key === 'Escape') cancelEditing();
                            }}
                          />
                          <div className="grid grid-cols-2 gap-2">
                            <select
                              value={editingCat}
                              onChange={(e) => { setEditingCat(e.target.value); setEditingSub(""); }}
                              className="px-2 py-1 text-xs bg-[#0b0e15] border border-[#2a2f45] rounded-lg focus:outline-none"
                            >
                              <option value="">— choose category —</option>
                              {categories.filter(c=>c.parentId==null).map(c => (
                                <option key={c.id} value={c.id}>{c.name}</option>
                              ))}
                            </select>
                            <select
                              value={editingSub}
                              onChange={(e) => setEditingSub(e.target.value)}
                              className="px-2 py-1 text-xs bg-[#0b0e15] border border-[#2a2f45] rounded-lg focus:outline-none"
                              disabled={!editingCat}
                            >
                              <option value="">— optional subcategory —</option>
                              {editingSubcats.map(sc => (
                                <option key={sc.id} value={sc.id}>{sc.name}</option>
                              ))}
                            </select>
                          </div>
                          <div className="flex gap-2">
                            <button 
                              onClick={saveEditing}
                              className="text-xs px-2 py-1 bg-green-600 hover:bg-green-700 rounded-lg transition-colors"
                            >
                              Save
                            </button>
                            <button 
                              onClick={cancelEditing}
                              className="text-xs px-2 py-1 bg-gray-600 hover:bg-gray-700 rounded-lg transition-colors"
                            >
                              Cancel
                            </button>
                            <button 
                              onClick={() => deleteGoal(g.id)}
                              className="text-xs px-2 py-1 bg-red-600 hover:bg-red-700 rounded-lg transition-colors"
                            >
                              Delete
                            </button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <div 
                            className="flex-1 cursor-pointer hover:opacity-80 transition-opacity" 
                            onClick={() => toggleGoalTimer(g.id)}
                            title={isRunning ? "Click to stop timer" : "Click to start timer"}
                          >
                            <div className="text-sm">{g.text}</div>
                            <div className="text-xs opacity-70 mt-1">{formatHMS(totalElapsed)}</div>
                          </div>
                          <button
                            onClick={(e) => { e.stopPropagation(); startEditing(g); }}
                            className="opacity-60 hover:opacity-100 flex-shrink-0"
                            title="Edit goal"
                          >
                            <Pencil size={14} />
                          </button>
                          <div className="text-xs opacity-70 flex-shrink-0">{name}</div>
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Completed goals */}
        <div className="rounded-2xl border border-[#1f2337] bg-[#161925] p-4">
          <div className="text-sm font-semibold mb-2">Completed</div>
          {done.length === 0 ? (
            <div className="text-xs opacity-60">No completed goals yet.</div>
          ) : (
            <div className="space-y-2">
              {done.map(g => {
                const color = getCategoryColor(categories, g.categoryId);
                const name = getCategoryPathName(categories, g.categoryId);
                const isEditing = editingGoal === g.id;
                const totalElapsed = g.totalSeconds || 0;
                
                return (
                  <div key={g.id} className="flex items-center gap-2 p-3 bg-[#0f1117] rounded-2xl border border-[#1f2337]">
                    <button 
                      onClick={() => toggleGoalCompletion(g.id)}
                      className="w-5 h-5 rounded-full hover:opacity-80 transition-opacity flex-shrink-0" 
                      style={{ background: color }} 
                      title="Mark incomplete"
                    />
                    
                    {isEditing ? (
                      <div className="flex-1 space-y-2">
                        <input
                          type="text"
                          value={editingText}
                          onChange={(e) => setEditingText(e.target.value)}
                          className="w-full px-2 py-1 text-sm bg-[#0b0e15] border border-[#2a2f45] rounded-lg focus:outline-none"
                          autoFocus
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') saveEditing();
                            if (e.key === 'Escape') cancelEditing();
                          }}
                        />
                        <div className="grid grid-cols-2 gap-2">
                          <select
                            value={editingCat}
                            onChange={(e) => { setEditingCat(e.target.value); setEditingSub(""); }}
                            className="px-2 py-1 text-xs bg-[#0b0e15] border border-[#2a2f45] rounded-lg focus:outline-none"
                          >
                            <option value="">— choose category —</option>
                            {categories.filter(c=>c.parentId==null).map(c => (
                              <option key={c.id} value={c.id}>{c.name}</option>
                            ))}
                          </select>
                          <select
                            value={editingSub}
                            onChange={(e) => setEditingSub(e.target.value)}
                            className="px-2 py-1 text-xs bg-[#0b0e15] border border-[#2a2f45] rounded-lg focus:outline-none"
                            disabled={!editingCat}
                          >
                            <option value="">— optional subcategory —</option>
                            {editingSubcats.map(sc => (
                              <option key={sc.id} value={sc.id}>{sc.name}</option>
                            ))}
                          </select>
                        </div>
                        <div className="flex gap-2">
                          <button 
                            onClick={saveEditing}
                            className="text-xs px-2 py-1 bg-green-600 hover:bg-green-700 rounded-lg transition-colors"
                          >
                            Save
                          </button>
                          <button 
                            onClick={cancelEditing}
                            className="text-xs px-2 py-1 bg-gray-600 hover:bg-gray-700 rounded-lg transition-colors"
                          >
                            Cancel
                          </button>
                          <button 
                            onClick={() => deleteGoal(g.id)}
                            className="text-xs px-2 py-1 bg-red-600 hover:bg-red-700 rounded-lg transition-colors"
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="flex-1">
                          <div 
                            className="text-sm" 
                            style={{ textDecoration: "line-through", textDecorationThickness: "1px", textDecorationColor: color }}
                          >
                            {g.text}
                          </div>
                          <div className="text-xs opacity-70 mt-1">{formatHMS(totalElapsed)}</div>
                        </div>
                        <button
                          onClick={(e) => { e.stopPropagation(); startEditing(g); }}
                          className="opacity-60 hover:opacity-100 flex-shrink-0"
                          title="Edit goal"
                        >
                          <Pencil size={14} />
                        </button>
                        <div className="text-xs opacity-70 flex-shrink-0">{name}</div>
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// TimerDisplay component - handles live timer updates without affecting chart
function TimerDisplay({ 
  runningSession, 
  runningName, 
  runningTotalSeconds, 
  todayStr 
}: {
  runningSession: Session | null;
  runningName: string;
  runningTotalSeconds: number;
  todayStr: string;
}) {
  const [displayTime, setDisplayTime] = useState(runningTotalSeconds);
  
  useEffect(() => {
    if (runningSession) {
      const interval = setInterval(() => {
        const now = Date.now();
        const elapsed = Math.floor((now - runningSession.start) / 1000);
        setDisplayTime(elapsed);
      }, 100); // Update every 100ms for smooth counting
      
      return () => clearInterval(interval);
    } else {
      setDisplayTime(runningTotalSeconds);
    }
  }, [runningSession, runningTotalSeconds]);

  if (runningSession) {
    return (
      <>
        <div className="text-lg font-semibold mt-1">{truncateText(runningName)}</div>
        <div className="text-sm mt-1">{formatHMS(displayTime)}</div>
      </>
    );
  } else {
    return (
      <>
        <div className="text-xs opacity-70">Time Range</div>
        <div className="text-[13px] opacity-80 mt-1">Click to select</div>
      </>
    );
  }
}

// RangeSelector component - isolated from timer updates
function RangeSelector({ 
  range, 
  rangeMenuOpen, 
  setRangeMenuOpen, 
  selectRange 
}: {
  range: Range;
  rangeMenuOpen: boolean;
  setRangeMenuOpen: (open: boolean) => void;
  selectRange: (newRange: Range) => void;
}) {
  return (
    <>
      <button 
        onClick={() => setRangeMenuOpen(!rangeMenuOpen)}
        className="text-[13px] opacity-80 hover:opacity-100 transition-opacity pointer-events-auto"
      >
        {range} ▼
      </button>
      
      {/* Range dropdown menu - positioned outside the dial */}
      {rangeMenuOpen && (
        <div className="absolute top-full left-1/2 transform -translate-x-1/2 mt-2 bg-[#161925] border border-[#1f2337] rounded-xl shadow-xl z-50 min-w-[120px] pointer-events-auto">
          {(["Today", "Week", "Month", "Year", "All"] as Range[]).map((r) => (
            <button
              key={r}
              onClick={() => selectRange(r)}
              className={`w-full px-4 py-2 text-left text-sm transition-colors first:rounded-t-xl last:rounded-b-xl hover:bg-[#1a1d2e] ${
                r === range ? "bg-blue-600/20 text-blue-400" : "text-white"
              }`}
            >
              {r}
            </button>
          ))}
        </div>
      )}
    </>
  );
}

// Old RangeSelector component - defined outside to prevent re-creation on timer updates
function OldRangeSelector({ 
  range, 
  rangeMenuOpen, 
  setRangeMenuOpen, 
  selectRange 
}: {
  range: Range;
  rangeMenuOpen: boolean;
  setRangeMenuOpen: (open: boolean) => void;
  selectRange: (newRange: Range) => void;
}) {
  return (
    <>
      <button 
        onClick={() => setRangeMenuOpen(!rangeMenuOpen)}
        className="text-[13px] opacity-80 mt-1 hover:opacity-100 transition-opacity flex items-center gap-1 pointer-events-auto"
      >
        {range}
        <span className="text-xs">▼</span>
      </button>
      
      {/* Range dropdown menu - positioned inside the dial */}
      {rangeMenuOpen && (
        <div className="absolute top-24 left-1/2 transform -translate-x-1/2 bg-[#161925] border border-[#1f2337] rounded-xl shadow-xl z-50 min-w-[120px] pointer-events-auto">
          {(["Today", "Week", "Month", "Year", "All"] as Range[]).map((r) => (
            <button
              key={r}
              onClick={() => selectRange(r)}
              className={`w-full px-4 py-2 text-left text-sm transition-colors first:rounded-t-xl last:rounded-b-xl hover:bg-[#1a1d2e] ${
                r === range ? "bg-blue-600/20 text-blue-400" : "text-white"
              }`}
            >
              {r}
            </button>
          ))}
        </div>
      )}
    </>
  );
}

// HomePage component - defined outside to prevent re-creation on timer updates
function HomePage({ 
  userName, 
  loggedIn, 
  authMode, 
  tempName, 
  setAuthMode, 
  setTempName, 
  handleLogin, 
  handleCreateUser, 
  handleLogout, 
  setPage,
  exportCSV,
  resetAll
}: {
  userName: string;
  loggedIn: boolean;
  authMode: "login" | "create";
  tempName: string;
  setAuthMode: (mode: "login" | "create") => void;
  setTempName: (name: string) => void;
  handleLogin: () => void;
  handleCreateUser: () => void;
  handleLogout: () => void;
  setPage: (page: Page) => void;
  exportCSV: () => void;
  resetAll: () => void;
}) {
  return (
    <div className="px-5 mt-6 flex-1">
      <div className="max-w-xl mx-auto space-y-4">
        {/* Welcome Section */}
        <div className="text-center mb-6">
          <h1 className="text-2xl font-bold mb-2">Time Tracker</h1>
          <p className="text-sm opacity-70">Track your time and achieve your goals</p>
        </div>

        <div className="bg-[#161925] border border-[#1f2337] rounded-2xl p-6">
          <div className="text-lg font-semibold mb-4 text-center">Account</div>
          {!loggedIn ? (
            <div className="space-y-4">
              {/* Auth Mode Toggle */}
              <div className="flex bg-[#0f1117] rounded-xl p-1">
                <button
                  onClick={() => setAuthMode("login")}
                  className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-colors ${
                    authMode === "login" 
                      ? "bg-white text-black" 
                      : "text-white opacity-70 hover:opacity-100"
                  }`}
                >
                  Login
                </button>
                <button
                  onClick={() => setAuthMode("create")}
                  className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-colors ${
                    authMode === "create" 
                      ? "bg-white text-black" 
                      : "text-white opacity-70 hover:opacity-100"
                  }`}
                >
                  Create Account
                </button>
              </div>

              {/* Auth Form */}
              <div className="space-y-3">
                <input
                  type="text"
                  placeholder={authMode === "create" ? "Choose your name" : "Enter your name"}
                  value={tempName}
                  onChange={(e) => setTempName(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl bg-[#0f1117] border border-[#2a2f45] focus:outline-none focus:border-blue-500"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      if (authMode === "create") handleCreateUser();
                      else handleLogin();
                    }
                  }}
                />
                <button 
                  onClick={authMode === "create" ? handleCreateUser : handleLogin}
                  className="w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-medium transition-colors"
                  disabled={!tempName.trim()}
                >
                  {authMode === "create" ? "Create Account" : "Login"}
                </button>
              </div>

              {/* Additional Info for Create Mode */}
              {authMode === "create" && (
                <div className="text-xs opacity-60 text-center">
                  Create a new account to start tracking your time
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              <div className="text-center">
                <div className="w-16 h-16 bg-blue-600 rounded-full flex items-center justify-center mx-auto mb-3">
                  <span className="text-2xl font-bold">{userName.charAt(0).toUpperCase()}</span>
                </div>
                <div className="text-lg font-semibold">Welcome back, {userName}!</div>
                <div className="text-sm opacity-70 mt-1">Ready to track your time?</div>
              </div>
              
              <div className="flex gap-3">
                <button 
                  onClick={() => setPage("Time")}
                  className="flex-1 py-3 rounded-xl bg-green-600 hover:bg-green-700 text-white font-medium transition-colors"
                >
                  Start Tracking
                </button>
                <button 
                  onClick={handleLogout}
                  className="px-4 py-3 rounded-xl border border-[#2a2f45] bg-[#0f1117] hover:bg-[#1a1d2e] transition-colors"
                >
                  Logout
                </button>
              </div>
            </div>
          )}
        </div>

        {loggedIn && (
          <div className="bg-[#161925] border border-[#1f2337] rounded-2xl p-4">
            <div className="text-lg font-semibold mb-2">Data</div>
            <div className="flex gap-3 flex-wrap">
              <button onClick={exportCSV} className="flex items-center gap-2 px-3 py-2 rounded-xl border border-[#2a2f45] hover:border-white/50 bg-[#0f1117]">Export CSV</button>
              <button onClick={resetAll} className="flex items-center gap-2 px-3 py-2 rounded-xl border border-[#2a2f45] hover:border-white/50 bg-[#0f1117] text-red-300">Reset</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// --- Main Component ---
export default function TimeTrackerMVP() {
  const [page, setPage] = useState<Page>("Time");
  const [userName, setUserName] = useState<string>("");
  const [authMode, setAuthMode] = useState<"login" | "create">("login");
  const [tempName, setTempName] = useState<string>("");
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const [categories, setCategories] = useState<Category[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);

  const [visionPhotos, setVisionPhotos] = useState<VisionPhoto[]>([]);
  const [goals, setGoals] = useState<Goal[]>([]);

  const [range, setRange] = useState<Range>("Today"); // default Today (24h)
  const [rangeMenuOpen, setRangeMenuOpen] = useState(false);
  const rangeMenuRef = useRef<boolean>(false);
  const [currentParentId, setCurrentParentId] = useState<string | null>(null);
  const scrollPositionRef = useRef<number>(0); // null = top-level
  const [editMode, setEditMode] = useState(false); // pencil toggle for overlay edit icons

  // A ticking value that increments each second to drive live updates.
  // Pause the live tick while adding/editing to keep inputs snappy.
  const [tick, setTick] = useState(0);
  const [adderOpen, setAdderOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  useEffect(() => {
    if (adderOpen || editingId) return; // suspend while typing
    const id = setInterval(() => setTick((t) => (t + 1) % 1_000_000_000), 1000);
    return () => clearInterval(id);
  }, [adderOpen, editingId]);

  // Dev self-tests
  useEffect(() => {
    runSelfTests();
  }, []);

  // Initialize Supabase auth and data
  useEffect(() => {
    const initializeApp = async () => {
      try {
        // Check current user
        const { user } = await dataService.getCurrentUser();
        
        if (user) {
          setIsAuthenticated(true);
          setUserName(user.username || user.display_name || "");
          
          // Load data from Supabase
          const [categoriesData, sessionsData, goalsData, visionPhotosData] = await Promise.all([
            dataService.getCategories(),
            dataService.getSessions(),
            dataService.getGoals(),
            dataService.getVisionPhotos()
          ]);
          
          // Convert Supabase data to app format
          setCategories(categoriesData.map(c => ({
            id: c.id,
            name: c.name,
            color: c.color,
            goalPct: c.goal_pct || undefined,
            icon: c.icon || undefined,
            parentId: c.parent_id || undefined
          })));
          
          setSessions(sessionsData.map(s => ({
            id: s.id,
            categoryId: s.category_id,
            start: new Date(s.start_time).getTime(),
            end: s.end_time ? new Date(s.end_time).getTime() : undefined
          })));
          
          setGoals(() => goalsData.map(g => ({
            id: g.id,
            text: g.text,
            categoryId: g.category_id,
            completed: g.completed,
            createdAt: new Date(g.created_at).getTime(),
            totalSeconds: g.total_seconds || 0,
            isActive: g.is_active || false,
            lastStartTime: g.last_start_time ? new Date(g.last_start_time).getTime() : undefined
          })));
          
          setVisionPhotos(visionPhotosData.map(v => ({
            id: v.id,
            src: v.src,
            alt: v.alt
          })));
          
          // Initialize default vision photos if less than 8 exist
          if (visionPhotosData.length < 8) {
            // Create only the missing photos to reach 8 total
            const photosToCreate = DEFAULT_VISION.slice(visionPhotosData.length);
            for (const photo of photosToCreate) {
              await dataService.createVisionPhoto({
                src: photo.src,
                alt: photo.alt
              });
            }
            // Reload vision photos
            const newPhotosData = await dataService.getVisionPhotos();
            setVisionPhotos(newPhotosData.map(v => ({
              id: v.id,
              src: v.src,
              alt: v.alt
            })));
          }
          
          // Set up real-time subscriptions
          dataService.subscribeToCategories((newCategories) => {
            setCategories(newCategories.map(c => ({
              id: c.id,
              name: c.name,
              color: c.color,
              goalPct: c.goal_pct || undefined,
              icon: c.icon || undefined,
              parentId: c.parent_id || undefined
            })));
          });
          
          dataService.subscribeToSessions((newSessions) => {
            setSessions(newSessions.map(s => ({
              id: s.id,
              categoryId: s.category_id,
              start: new Date(s.start_time).getTime(),
              end: s.end_time ? new Date(s.end_time).getTime() : undefined
            })));
          });
          
          dataService.subscribeToGoals((newGoals) => {
            setGoals(newGoals.map(g => ({
              id: g.id,
              text: g.text,
              categoryId: g.category_id,
              completed: g.completed,
              createdAt: new Date(g.created_at).getTime(),
              totalSeconds: g.total_seconds || 0,
              isActive: g.is_active || false,
              lastStartTime: g.last_start_time ? new Date(g.last_start_time).getTime() : undefined
            })));
          });
          
          dataService.subscribeToVisionPhotos((newPhotos) => {
            setVisionPhotos(newPhotos.map(v => ({
              id: v.id,
              src: v.src,
              alt: v.alt
            })));
          });
          
        } else {
          // Check for localStorage data to migrate
          if (MigrationService.hasLocalStorageData()) {
            const hasSupabaseData = await MigrationService.hasSupabaseData();
            if (!hasSupabaseData) {
              // Show migration option
              console.log("Found localStorage data to migrate");
            }
          }
          
          // Load default data for unauthenticated users
          setCategories(DEFAULT_CATEGORIES);
          setVisionPhotos(DEFAULT_VISION);
        }
        
        // Load preferences from localStorage
        const prefsRaw = localStorage.getItem(PREFS_KEY);
        if (prefsRaw) {
          const p = JSON.parse(prefsRaw);
          if (p.preferredRange) setRange(p.preferredRange as Range);
        }
        
      } catch (error) {
        console.error("Error initializing app:", error);
        // Fallback to default data
        setCategories(DEFAULT_CATEGORIES);
        setVisionPhotos(DEFAULT_VISION);
      } finally {
        setIsLoading(false);
      }
    };
    
    initializeApp();
  }, []);

  // Persist preferences to localStorage (only for non-sensitive data)
  useEffect(() => {
    if (typeof window === "undefined") return;
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ currentParentId, authMode })
    );
  }, [currentParentId, authMode]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const prefs = { preferredRange: range };
    localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
  }, [range]);

  // Recompute window on every tick so the live session grows and Today resets at local midnight
  const { start: windowStart, end: windowEnd } = useMemo(
    () => rangeBounds(range),
    [range, tick]
  );

  // Hover-freeze for chart to avoid tooltip flicker
  const hoverNowRef = useRef<number | null>(null);
  const [chartHover, setChartHover] = useState(false);


  // Visible list depends on navigation level
  const visibleCategories = useMemo(
    () => categories.filter((c) => (c.parentId ?? null) === currentParentId),
    [categories, currentParentId]
  );

  // Direct & rolled-up totals (live)
  const directSeconds = useMemo(
    () => computeDirectSeconds(sessions, windowStart, windowEnd, goals),
    [sessions, windowStart, windowEnd, goals, tick]
  );
  const rolledSeconds = useMemo(
    () => rollupSeconds(categories, directSeconds),
    [categories, directSeconds]
  );

  // Direct & rolled-up totals for CHART only (freeze while hovering)
  const directSecondsChart = useMemo(() => {
    const endForChart = chartHover && hoverNowRef.current ? hoverNowRef.current : windowEnd;
    return computeDirectSeconds(sessions, windowStart, endForChart, goals);
  }, [sessions, windowStart, windowEnd, goals, chartHover, tick]);
  const rolledSecondsChart = useMemo(
    () => rollupSeconds(categories, directSecondsChart),
    [categories, directSecondsChart]
  );

  // Chart data (use chart-frozen values)
  const chartData = useMemo(
    () =>
      visibleCategories.map((c) => ({
        name: c.name,
        value: rolledSecondsChart[c.id] || 0,
        color: c.color,
      })),
    [visibleCategories, rolledSecondsChart]
  );

  const grandTotalVisible = useMemo(
    () => visibleCategories.reduce((sum, c) => sum + (rolledSeconds[c.id] ?? 0), 0),
    [visibleCategories, rolledSeconds]
  );

  const runningSession = useMemo(() => sessions.find((s) => !s.end), [sessions]);
  const runningName = runningSession ? categories.find((c) => c.id === runningSession.categoryId)?.name ?? "" : "";
  const runningTotalSeconds = runningSession ? (directSeconds[runningSession.categoryId] ?? 0) : 0;

  // Actions
  async function startCategory(id: string) {
    await stopAllActiveTimers();
    
    if (isAuthenticated) {
      try {
        const newSession = await dataService.createSession({
          category_id: id,
          start_time: new Date().toISOString(),
          end_time: null,
          duration_seconds: null
        });
        
        if (newSession) {
          setActiveId(id);
          // Manually refresh sessions to ensure UI updates
          const sessionsData = await dataService.getSessions();
          setSessions(sessionsData.map(s => ({
            id: s.id,
            categoryId: s.category_id,
            start: new Date(s.start_time).getTime(),
            end: s.end_time ? new Date(s.end_time).getTime() : undefined
          })));
        }
      } catch (error) {
        console.error("Error starting session:", error);
        alert("Failed to start session. Please try again.");
      }
    } else {
      // Fallback for unauthenticated users
      const newS: Session = { id: uid(), categoryId: id, start: Date.now() };
      setSessions((prev) => [...prev, newS]);
      setActiveId(id);
    }
  }

  async function stopRunning() {
    const runningSession = sessions.find((s) => !s.end);
    if (runningSession) {
      if (isAuthenticated) {
        try {
          const endTime = new Date().toISOString();
          const durationSeconds = Math.round((Date.now() - runningSession.start) / 1000);
          
          await dataService.updateSession(runningSession.id, {
            end_time: endTime,
            duration_seconds: durationSeconds
          });
          
          setActiveId(null);
          
          // Manually refresh sessions to ensure UI updates
          const sessionsData = await dataService.getSessions();
          setSessions(sessionsData.map(s => ({
            id: s.id,
            categoryId: s.category_id,
            start: new Date(s.start_time).getTime(),
            end: s.end_time ? new Date(s.end_time).getTime() : undefined
          })));
        } catch (error) {
          console.error("Error stopping session:", error);
          alert("Failed to stop session. Please try again.");
        }
      } else {
        // Fallback for unauthenticated users
        setSessions((prev) => {
          const next = [...prev];
          for (let i = next.length - 1; i >= 0; i--) {
            if (next[i].end == null) {
              next[i] = { ...next[i], end: Date.now() };
              break;
            }
          }
          return next;
        });
        setActiveId(null);
      }
    }
  }

  // Helper to stop all active goals under a category
  async function stopActiveGoalsUnder(categoryId: string) {
    const childIds = categories.filter(c => c.parentId === categoryId).map(c => c.id);
    const allRelatedIds = [categoryId, ...childIds];
    const activeGoalsUnder = goals.filter(g => g.isActive && allRelatedIds.includes(g.categoryId));
    
    if (isAuthenticated) {
      for (const goal of activeGoalsUnder) {
        const now = Date.now();
        const sessionSeconds = goal.lastStartTime 
          ? Math.floor((now - goal.lastStartTime) / 1000) 
          : 0;
        const newTotal = (goal.totalSeconds || 0) + sessionSeconds;
        
        await dataService.updateGoal(goal.id, {
          is_active: false,
          total_seconds: newTotal,
          last_start_time: null
        });
      }
      
      // Refresh goals if any were stopped
      if (activeGoalsUnder.length > 0) {
        const goalsData = await dataService.getGoals();
        setGoals(() => goalsData.map(g => ({
          id: g.id,
          text: g.text,
          categoryId: g.category_id,
          completed: g.completed,
          createdAt: new Date(g.created_at).getTime(),
          totalSeconds: g.total_seconds || 0,
          isActive: g.is_active || false,
          lastStartTime: g.last_start_time ? new Date(g.last_start_time).getTime() : undefined
        })));
      }
    } else {
      // Local state for unauthenticated users
      setGoals(prev => prev.map(g => {
        if (activeGoalsUnder.find(ag => ag.id === g.id)) {
          const now = Date.now();
          const sessionSeconds = g.lastStartTime ? Math.floor((now - g.lastStartTime) / 1000) : 0;
          return { ...g, isActive: false, totalSeconds: (g.totalSeconds || 0) + sessionSeconds, lastStartTime: undefined };
        }
        return g;
      }));
    }
  }

  // Helper to stop ALL active timers (both sessions and goals)
  async function stopAllActiveTimers() {
    // Stop any running session
    await stopRunning();
    
    // Stop all active goals
    const activeGoals = goals.filter(g => g.isActive);
    
    if (isAuthenticated) {
      for (const goal of activeGoals) {
        const now = Date.now();
        const sessionSeconds = goal.lastStartTime 
          ? Math.floor((now - goal.lastStartTime) / 1000) 
          : 0;
        const newTotal = (goal.totalSeconds || 0) + sessionSeconds;
        
        await dataService.updateGoal(goal.id, {
          is_active: false,
          total_seconds: newTotal,
          last_start_time: null
        });
      }
      
      // Refresh goals if any were stopped
      if (activeGoals.length > 0) {
        const goalsData = await dataService.getGoals();
        setGoals(() => goalsData.map(g => ({
          id: g.id,
          text: g.text,
          categoryId: g.category_id,
          completed: g.completed,
          createdAt: new Date(g.created_at).getTime(),
          totalSeconds: g.total_seconds || 0,
          isActive: g.is_active || false,
          lastStartTime: g.last_start_time ? new Date(g.last_start_time).getTime() : undefined
        })));
      }
    } else {
      // Local state for unauthenticated users
      setGoals(prev => prev.map(g => {
        if (g.isActive) {
          const now = Date.now();
          const sessionSeconds = g.lastStartTime ? Math.floor((now - g.lastStartTime) / 1000) : 0;
          return { ...g, isActive: false, totalSeconds: (g.totalSeconds || 0) + sessionSeconds, lastStartTime: undefined };
        }
        return g;
      }));
    }
  }

  const toggleCategory = useCallback(async (id: string) => {
    // Store current scroll position
    scrollPositionRef.current = window.scrollY;
    
    // Check if this category is highlighted due to active children/goals
    const isHighlighted = isCategoryHighlighted(id);
    
    if (activeId === id) {
      // Direct session running on this category - stop it
      await stopRunning();
    } else if (isHighlighted) {
      // Category is highlighted due to active child/goal - stop all active items under this category
      await stopRunning(); // Stop any active session
      await stopActiveGoalsUnder(id); // Stop all active goals
    } else {
      // Start new session on this category
      await startCategory(id);
    }
    
    // Restore scroll position after state update
    requestAnimationFrame(() => {
      window.scrollTo(0, scrollPositionRef.current);
    });
  }, [activeId, sessions, goals, categories]);

  async function handleLogin() {
    if (tempName.trim()) {
      try {
        // Sign in with username
        const { user, error } = await dataService.signInWithUsername(tempName.trim());
        
        if (error) {
          alert("Failed to login: " + error.message);
          return;
        }
        
        if (user) {
          setUserName(user.username);
          setIsAuthenticated(true);
          setTempName("");
          
          // Reload to load user data
          window.location.reload();
        }
      } catch (error) {
        console.error("Login error:", error);
        alert("Failed to login. Please try again.");
      }
    }
  }

  async function handleCreateUser() {
    if (tempName.trim()) {
      try {
        // Create user with username (will auto-create if doesn't exist)
        const { user, error } = await dataService.signInWithUsername(tempName.trim());
        
        if (error) {
          alert("Failed to create account: " + error.message);
          return;
        }
        
        if (user) {
          setUserName(user.username);
          setIsAuthenticated(true);
          setTempName("");
          
          // Create default categories for new user
          const categoriesData = await dataService.getCategories();
          if (categoriesData.length === 0) {
            for (const category of DEFAULT_CATEGORIES) {
              await dataService.createCategory({
                name: category.name,
                color: category.color,
                goal_pct: category.goalPct || null,
                icon: category.icon || null,
                parent_id: null
              });
            }
            
            // Create default vision photos
            for (const photo of DEFAULT_VISION) {
              await dataService.createVisionPhoto({
                src: photo.src,
                alt: photo.alt
              });
            }
          }
          
          // Reload data from Supabase
          window.location.reload();
        }
      } catch (error) {
        console.error("Create user error:", error);
        alert("Failed to create account. Please try again.");
      }
    }
  }

  async function handleLogout() {
    try {
      await dataService.signOut();
      setUserName("");
      setTempName("");
      setIsAuthenticated(false);
      setAuthMode("login");
      setCategories(DEFAULT_CATEGORIES);
      setSessions([]);
      setGoals([]);
      setVisionPhotos(DEFAULT_VISION);
      setActiveId(null);
    } catch (error) {
      console.error("Logout error:", error);
    }
  }

  function selectRange(newRange: Range) {
    setRange(newRange);
    setRangeMenuOpen(false);
    rangeMenuRef.current = false;
  }



  function openSubcategories(id: string) {
    setCurrentParentId(id);
  }

  function goBack() {
    if (currentParentId == null) return;
    const parent = categories.find((c) => c.id === currentParentId)?.parentId ?? null;
    setCurrentParentId(parent ?? null);
  }

  // Inline Add Category/Subcategory UI state is handled via AddForm component
  function openAdder() {
    setAdderOpen(true);
  }
  async function addCategory(cat: { name: string; goalPct?: number; color: string; parentId: string | null }) {
    // Validate goal caps: root total <= 100, child totals <= 100
    if (cat.parentId == null) {
      const sum = computeRootGoalSum(categories, { goal: cat.goalPct ?? 0 });
      if (sum > 100) {
        alert(`Category goals must not exceed 100%. Current total would be ${sum}%. Please adjust.`);
        return;
      }
    } else {
      const sum = computeChildGoalSum(categories, cat.parentId, { goal: cat.goalPct ?? 0 });
      if (sum > 100) {
        alert(`Subcategory goals must not exceed 100%. Current total would be ${sum}%. Please adjust.`);
        return;
      }
    }
    
    // For subcategories, generate a shade based on the parent's color
    let finalColor = cat.color;
    if (cat.parentId !== null) {
      const parentCategory = categories.find(c => c.id === cat.parentId);
      if (parentCategory) {
        const existingSubcats = categories.filter(c => c.parentId === cat.parentId);
        const shadeIndex = existingSubcats.length;
        finalColor = generateColorShade(parentCategory.color, shadeIndex);
        console.log(`Creating subcategory with parent color: ${parentCategory.color}, shadeIndex: ${shadeIndex}, finalColor: ${finalColor}`);
      }
    }
    
    try {
      const newCategory = await dataService.createCategory({
        name: cat.name,
        color: finalColor,
        goal_pct: cat.goalPct || null,
        icon: "🕒",
        parent_id: cat.parentId
      });
      
      if (newCategory) {
        console.log("Category created successfully:", newCategory);
        // Manually refresh categories to ensure UI updates
        const categoriesData = await dataService.getCategories();
        setCategories(categoriesData.map(c => ({
          id: c.id,
          name: c.name,
          color: c.color,
          goalPct: c.goal_pct || undefined,
          icon: c.icon || undefined,
          parentId: c.parent_id || undefined
        })));
      }
    } catch (error) {
      console.error("Error creating category:", error);
      alert("Failed to create category. Please try again.");
    }
  }

  function exportCSV() {
    const rows = [
      ["session_id", "category", "start_iso", "end_iso", "seconds"],
      ...sessions.map((s) => {
        const c = categories.find((x) => x.id === s.categoryId)?.name ?? s.categoryId;
        const end = s.end ?? Date.now();
        const sec = Math.round((end - s.start) / 1000);
        return [s.id, c, new Date(s.start).toISOString(), new Date(end).toISOString(), String(sec)];
      }),
    ];
    const csv = rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `time_sessions_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function resetAll() {
    if (!window.confirm("Reset all data?")) return;
    
    if (isAuthenticated) {
      try {
        // Delete all user data from Supabase
        const [categoriesData, sessionsData, goalsData, visionPhotosData] = await Promise.all([
          dataService.getCategories(),
          dataService.getSessions(),
          dataService.getGoals(),
          dataService.getVisionPhotos()
        ]);
        
        // Delete all items
        await Promise.all([
          ...categoriesData.map(c => dataService.deleteCategory(c.id)),
          ...sessionsData.map(s => dataService.deleteSession(s.id)),
          ...goalsData.map(g => dataService.deleteGoal(g.id)),
          ...visionPhotosData.map(v => dataService.deleteVisionPhoto(v.id))
        ]);
        
        // Create default data
        for (const category of DEFAULT_CATEGORIES) {
          await dataService.createCategory({
            name: category.name,
            color: category.color,
            goal_pct: category.goalPct || null,
            icon: category.icon || null,
            parent_id: null
          });
        }
        
        for (const photo of DEFAULT_VISION) {
          await dataService.createVisionPhoto({
            src: photo.src,
            alt: photo.alt
          });
        }
        
        // Reload to show fresh data
        window.location.reload();
      } catch (error) {
        console.error("Error resetting data:", error);
        alert("Failed to reset data. Please try again.");
      }
    } else {
      setCategories(DEFAULT_CATEGORIES);
      setSessions([]);
      setActiveId(null);
      setCurrentParentId(null);
      setVisionPhotos(DEFAULT_VISION);
      setGoals([]);
    }
  }

  // Editing state
  const [editName, setEditName] = useState("");
  const [editGoal, setEditGoal] = useState<string>("");
  const [editColor, setEditColor] = useState("#888888");
  const [editIcon, setEditIcon] = useState<string>("🕒");

  function openEditor(id: string) {
    const cat = categories.find((c) => c.id === id);
    if (!cat) return;
    setEditingId(id);
    setEditName(cat.name);
    setEditGoal(cat.goalPct != null ? String(cat.goalPct) : "");
    setEditColor(cat.color);
    setEditIcon(cat.icon ?? "🕒");
  }

  async function saveEditor() {
    if (!editingId) return;
    const cat = categories.find((c) => c.id === editingId);
    if (!cat) return;
    const name = editName.trim();
    if (!name) return;
    const goal = editGoal ? Number(editGoal) : 0;

    // Enforce goal totals <= 100 for both root and child levels
    if (cat.parentId) {
      const sum = computeChildGoalSum(categories, cat.parentId, { id: cat.id, goal });
      if (sum > 100) {
        alert(`Subcategory goals for "${categories.find(c=>c.id===cat.parentId)?.name ?? "Parent"}" must not exceed 100%. Current total would be ${sum}%. Please adjust.`);
        return;
      }
    } else {
      const sumRoot = computeRootGoalSum(categories, { id: cat.id, goal });
      if (sumRoot > 100) {
        alert(`Category goals must not exceed 100%. Current total would be ${sumRoot}%. Please adjust.`);
        return;
      }
    }

    if (isAuthenticated) {
      try {
        await dataService.updateCategory(editingId, {
          name,
          goal_pct: goal || null,
          color: editColor,
          icon: editIcon
        });
        
        // Manually refresh categories
        const categoriesData = await dataService.getCategories();
        setCategories(categoriesData.map(c => ({
          id: c.id,
          name: c.name,
          color: c.color,
          goalPct: c.goal_pct || undefined,
          icon: c.icon || undefined,
          parentId: c.parent_id || undefined
        })));
      } catch (error) {
        console.error("Error updating category:", error);
        alert("Failed to update category. Please try again.");
      }
    } else {
      setCategories((prev) => prev.map((c) => (c.id === editingId ? { ...c, name, goalPct: goal || undefined, color: editColor, icon: editIcon } : c)));
    }
    
    setEditingId(null);
  }

  async function deleteCategory(id: string) {
    if (!isLeaf(categories, id)) {
      alert("Delete children first before deleting this category.");
      return;
    }
    if (!confirm("Delete this subcategory and its sessions?")) return;
    
    if (isAuthenticated) {
      try {
        await dataService.deleteCategory(id);
        
        // Manually refresh categories and sessions
        const [categoriesData, sessionsData] = await Promise.all([
          dataService.getCategories(),
          dataService.getSessions()
        ]);
        
        setCategories(categoriesData.map(c => ({
          id: c.id,
          name: c.name,
          color: c.color,
          goalPct: c.goal_pct || undefined,
          icon: c.icon || undefined,
          parentId: c.parent_id || undefined
        })));
        
        setSessions(sessionsData.map(s => ({
          id: s.id,
          categoryId: s.category_id,
          start: new Date(s.start_time).getTime(),
          end: s.end_time ? new Date(s.end_time).getTime() : undefined
        })));
      } catch (error) {
        console.error("Error deleting category:", error);
        alert("Failed to delete category. Please try again.");
      }
    } else {
      setCategories((prev) => prev.filter((c) => c.id !== id));
      setSessions((prev) => prev.filter((s) => s.categoryId !== id));
    }
    
    if (activeId === id) setActiveId(null);
    setEditingId(null);
  }

  // UI helpers
  function sharePct(catId: string) {
    if (grandTotalVisible === 0) return 0;
    return Math.round(((rolledSeconds[catId] || 0) / grandTotalVisible) * 100);
  }

  // Check if a category should be highlighted based on active state cascading
  function isCategoryHighlighted(catId: string): boolean {
    // Direct active session on this category
    if (activeId === catId) return true;
    
    // Check if any child categories are active
    const hasActiveChild = categories.some(c => c.parentId === catId && activeId === c.id);
    if (hasActiveChild) return true;
    
    // Check if any goals under this category or its children are active
    const childIds = categories.filter(c => c.parentId === catId).map(c => c.id);
    const allRelatedIds = [catId, ...childIds];
    const hasActiveGoal = goals.some(g => g.isActive && allRelatedIds.includes(g.categoryId));
    if (hasActiveGoal) return true;
    
    return false;
  }

  const headerCats = visibleCategories.slice(0, 3);
  const title = currentParentId
    ? `Subcategories • ${categories.find((c) => c.id === currentParentId)?.name ?? ""}`
    : "Categories";

  const todayStr = useMemo(() => new Date().toLocaleDateString("en-US"), [tick]);
  const loggedIn = isAuthenticated;

  // ---- Inline child components ----
  function AddForm({ parentId, parentColor, onSave, onClose, categories }: {
    parentId: string | null;
    parentColor?: string;
    onSave: (cat: { name: string; goalPct?: number; color: string; parentId: string | null }) => void;
    onClose: () => void;
    categories: Category[];
  }) {
    const [name, setName] = useState("");
    const [goal, setGoal] = useState<string>("");
    
    // For subcategories, show the actual shade that will be applied
    const defaultColor = parentId && parentColor 
      ? generateColorShade(parentColor, categories.filter(c => c.parentId === parentId).length)
      : randomColor();
    
    const [color, setColor] = useState<string>(defaultColor);

    const numericGoal = goal === "" ? 0 : Number(sanitizeGoalInput(goal));
    const proposedTotal = parentId ? computeChildGoalSum(categories, parentId, { goal: numericGoal }) : computeRootGoalSum(categories, { goal: numericGoal });
    const over = proposedTotal > 100;

    function save() {
      if (!name.trim()) return;
      if (over) return;
      onSave({ name: name.trim(), goalPct: numericGoal || undefined, color, parentId });
      onClose();
    }

    return (
      <div className="rounded-2xl p-4 mb-4 bg-[#161925] border border-[#1f2337]">
        <div className="flex flex-wrap items-center gap-3">
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={parentId ? "Subcategory name" : "Category name"}
            className="px-3 py-2 rounded-xl bg-[#0f1117] border border-[#2a2f45] focus:outline-none"
          />
          <input
            type="number"
            inputMode="numeric"
            pattern="[0-9]*"
            min={0}
            max={100}
            value={goal}
            onChange={(e) => setGoal(sanitizeGoalInput(e.target.value))}
            placeholder="Goal % (numbers)"
            className="w-44 px-3 py-2 rounded-xl bg-[#0f1117] border border-[#2a2f45] focus:outline-none"
            title="Goal percentage (0–100)"
          />
          <input
            type="color"
            value={color}
            onChange={(e) => setColor(e.target.value)}
            className="w-12 h-9 rounded-lg border border-[#2a2f45] bg-transparent"
            title="Color"
          />
          <button onClick={save} disabled={!name.trim() || over} className={`flex items-center gap-2 px-3 py-2 rounded-xl border ${(!name.trim() || over)?"opacity-60 cursor-not-allowed":"hover:border-white/50"} border-[#2a2f45] bg-[#0f1117]`}>
            <Check size={16} /> Save
          </button>
          <button onClick={onClose} className="px-3 py-2 rounded-xl border border-[#2a2f45] hover:border-white/50 bg-[#0f1117]">
            Cancel
          </button>
        </div>
        <div className={`text-xs mt-2 ${over?"text-red-400":"opacity-70"}`}>
          {over ? `Total ${parentId?"subcategories":"categories"} goals would be ${proposedTotal}%. Max is 100%. Reduce goals to save.` : `Total ${parentId?"subcategories":"categories"} after save: ${proposedTotal}% (max 100%).`}
        </div>
      </div>
    );
  }


  function TimePage() {
    const [chartRef, chartSize] = useElementSize<HTMLDivElement>();
    const hasMeasurement = chartSize.width > 0 && chartSize.height > 0;
    const baseSize = 200;
    const pieSize = hasMeasurement
      ? Math.min(chartSize.width, chartSize.height) * 0.9
      : baseSize;
    const radiusScale = pieSize / baseSize;
    const innerRadius = 75 * radiusScale;
    const outerRadius = 95 * radiusScale;

    return (
      <>
        {/* Top legend */}
        <div className="px-5 pt-5">
          <div className="flex justify-center">
            <div className="flex items-center gap-6 text-sm opacity-90">
              {headerCats.map((c) => (
                <div key={c.id} className="flex flex-col items-center">
                  <div className="flex items-center gap-2">
                    <span className="inline-block w-3 h-3 rounded-full" style={{ background: c.color }} />
                    <span>{c.name}</span>
                  </div>
                  <span className="text-xs mt-1">{sharePct(c.id)} %</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Dial and Range selector */}
        <div className="px-5 mt-4">
          <div className="bg-[#161925] rounded-2xl p-5 shadow-lg relative overflow-visible">
            <div
                 ref={chartRef}
                 className="h-64 flex items-center justify-center"
                 onMouseEnter={() => { setChartHover(true); hoverNowRef.current = Date.now(); }}
                 onMouseLeave={() => { setChartHover(false); hoverNowRef.current = null; }}
            >
              <PieChart width={pieSize} height={pieSize}>
                {/* Background ring so the dial is always visible */}
                <Pie data={[{ name: "track", value: 1 }]}
                     innerRadius={innerRadius}
                     outerRadius={outerRadius}
                     dataKey="value"
                     isAnimationActive={false}
                >
                  <Cell fill="#23283f" />
                </Pie>
                {/* Actual data overlay */}
                <Pie
                  data={chartData}
                  innerRadius={innerRadius}
                  outerRadius={outerRadius}
                  dataKey="value"
                  paddingAngle={2}
                  isAnimationActive={false}
                  cornerRadius={3}
                >
                  {chartData.map((entry, index) => (
                    <Cell key={`slice-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value: any, name: any) => [formatHMS(Number(value)), name]}
                  contentStyle={{ background: "#0f1117", border: "1px solid #2a2f45", borderRadius: 12, color: "#fff" }}
                />
              </PieChart>
            </div>

            {/* Center content of the dial */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="text-center mt-1">
                <div className="text-xs opacity-70 mb-1">{todayStr}</div>
                {runningSession ? (
                  <>
                    <div className="text-lg font-semibold mt-1">{truncateText(runningName)}</div>
                    <div className="text-sm mt-1">{formatHMS(runningTotalSeconds)}</div>
                  </>
                ) : (
                  <>
                    {/* Clickable range selector */}
                    <div className="relative">
                      <button
                        onClick={() => setRangeMenuOpen(!rangeMenuOpen)}
                        className="text-[13px] opacity-80 mt-1 hover:opacity-100 transition-opacity pointer-events-auto px-2 py-1 rounded-lg hover:bg-white/10"
                      >
                        {range} ▼
                      </button>
                      
                      {/* Range dropdown menu - positioned inside the dial */}
                      {rangeMenuOpen && (
                        <div className="absolute top-full left-1/2 transform -translate-x-1/2 mt-2 bg-[#161925] border border-[#1f2337] rounded-xl shadow-xl z-50 min-w-[120px] pointer-events-auto">
                          {(["Today", "Week", "Month", "Year", "All"] as Range[]).map((r) => (
                            <button
                              key={r}
                              onClick={() => {
                                setRange(r);
                                setRangeMenuOpen(false);
                              }}
                              className={`w-full px-4 py-2 text-left text-sm transition-colors first:rounded-t-xl last:rounded-b-xl hover:bg-[#1a1d2e] ${
                                r === range ? "bg-blue-600/20 text-blue-400" : "text-white"
                              }`}
                            >
                              {r}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </>
                )}
                <div className="text-center text-sm opacity-80 mt-2">
                  Total {formatHMS(grandTotalVisible)}
                </div>
              </div>
            </div>
            
          </div>
        </div>

        {/* Categories / Subcategories */}
        <div className="px-5 mt-6 flex-1">
          {/* Bar: left (back + pencil) / centered title / right (add) */}
          <div className="flex items-center mb-3">
            <div className="w-40 flex items-center gap-2">
              {currentParentId && (
                <button onClick={goBack} className="px-2 py-2 rounded-xl border border-[#2a2f45] bg-[#0f1117] hover:border-white/50" title="Back">←</button>
              )}
              <button
                onClick={() => setEditMode((e) => !e)}
                className={`px-2 py-2 rounded-xl border bg-[#0f1117] ${editMode ? "border-white/70" : "border-[#2a2f45] opacity-60"}`}
                title="Edit"
              >
                <Pencil size={16} />
              </button>
            </div>
            <div className="flex-1 text-center">
              <h2 className="text-xl font-semibold">{title}</h2>
            </div>
            <div className="w-40 flex items-center justify-end gap-2">
              {!adderOpen && (
                <button
                  onClick={openAdder}
                  className="px-2 py-2 rounded-xl border border-[#2a2f45] hover:border-white/50 bg-[#0f1117]"
                  title={currentParentId ? "Add Subcategory" : "Add Category"}
                >
                  <Plus size={16} />
                </button>
              )}
            </div>
          </div>

          {adderOpen && (
            <AddForm
              parentId={currentParentId}
              parentColor={currentParentId ? categories.find(c=>c.id===currentParentId)?.color : undefined}
              onSave={addCategory}
              onClose={() => setAdderOpen(false)}
              categories={categories}
            />
          )}

        <div className="space-y-3">
          {visibleCategories.map((c) => {
              const seconds = rolledSeconds[c.id] || 0;
              const pct = sharePct(c.id);
              const goal = c.goalPct ?? null;
              const goalText = goal != null ? `Goal of ${goal}%` : "";
              const isHighlighted = isCategoryHighlighted(c.id); // Cascading highlight from children/goals

              const highlight = isHighlighted ? `${c.color}33` : undefined; // tint active row

              return (
                <div
                  key={c.id}
                  className="relative rounded-2xl p-4 bg-[#161925] shadow border border-[#1f2337] cursor-pointer select-none"
                  style={{ background: highlight }}
                  onClick={(e) => { 
                    e.preventDefault(); 
                    e.stopPropagation();
                    toggleCategory(c.id); 
                  }}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleCategory(c.id); } }}
                >
                  {/* Overlay pencil (at all levels when edit mode is on) */}
                  {editMode && (
                    <button
                      onClick={(e) => { e.stopPropagation(); openEditor(c.id); }}
                      className="absolute left-1 top-1 opacity-60 hover:opacity-100"
                      title="Edit"
                    >
                      <Pencil size={14} />
                    </button>
                  )}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3 text-left" style={{ width: "100%" }}>
                      <div className="w-9 h-9 rounded-xl flex items-center justify-center text-xl" style={{ background: c.color + "26" }}>
                        <span className="select-none">{c.icon ?? "🕒"}</span>
                      </div>
                      <div className="flex-1">
                        <div className="text-[15px] font-medium">{c.name}</div>
                        <div className="text-xs opacity-70 mt-0.5">{goalText}</div>
                      </div>
                      <div className="text-[15px] font-semibold tabular-nums min-w-[120px] text-right">
                        {formatHMS(seconds)}
                      </div>
                      {/* Root-only chevron to enter subcategories */}
                      {!currentParentId && (
                        <button
                          onClick={(e) => { e.stopPropagation(); openSubcategories(c.id); }}
                          className="ml-2 p-1 rounded-lg border border-[#2a2f45] bg-[#0f1117] hover:border-white/50"
                          title="Open subcategories"
                        >
                          <ChevronRight size={16} />
                        </button>
                      )}
                    </div>
                  </div>
                  {/* progress vs goal (also part of the big button) */}
                  <div className="mt-3">
                    <div className="h-2 w-full bg-[#0f1117] rounded-full overflow-hidden">
                      <div className="h-full rounded-full" style={{ width: `${pct}%`, background: c.color }} />
                    </div>
                    <div className="flex justify-between text-xs opacity-70 mt-1">
                      <span>Share {pct}%</span>
                      {goal != null && <span>Goal {goal}%</span>}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </>
    );
  }


  // Icon options for editor
  const ICONS = ["🕒","📚","💼","🏃","🧘","🎮","🎵","🍽️","🛠️","🌱","🧑‍🍳","🧹","🛌","🚗","📈","🎯","👨‍👩‍👧","🐶","✈️","💻"];

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#11131a] text-white flex items-center justify-center">
        <div className="text-center">
          <div className="text-lg">Loading...</div>
          <div className="text-sm opacity-70 mt-2">Setting up your time tracker</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#11131a] text-white flex flex-col">
      {page === "Home" && <HomePage 
        userName={userName}
        loggedIn={loggedIn}
        authMode={authMode}
        tempName={tempName}
        setAuthMode={setAuthMode}
        setTempName={setTempName}
        handleLogin={handleLogin}
        handleCreateUser={handleCreateUser}
        handleLogout={handleLogout}
        setPage={setPage}
        exportCSV={exportCSV}
        resetAll={resetAll}
      />}
      {page === "Time" && <TimePage />}
      {page === "Vision" && <VisionPage 
        categories={categories}
        goals={goals}
        visionPhotos={visionPhotos}
        setGoals={setGoals}
        setVisionPhotos={setVisionPhotos}
        addCategory={addCategory}
        isAuthenticated={isAuthenticated}
        stopAllActiveTimers={stopAllActiveTimers}
      />}

      {/* Bottom Nav - Fixed to bottom */}
      <div className="fixed bottom-0 left-0 right-0 border-t border-[#1f2337] bg-[#0f1117] p-6 z-50">
        <div className="flex justify-around text-lg opacity-80">
          <button onClick={()=>setPage("Home")} className={page==="Home"?"text-blue-400":""}>Home</button>
          <button onClick={()=>setPage("Time")} className={page==="Time"?"text-blue-400":""}>Time</button>
          <button onClick={()=>setPage("Vision")} className={page==="Vision"?"text-blue-400":""}>Vision</button>
        </div>
      </div>
      
      {/* Spacer for fixed bottom nav */}
      <div className="h-24"></div>

      {/* Editor modal */}
      {editingId && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="w-full max-w-md bg-[#161925] border border-[#2a2f45] rounded-2xl p-5">
            {(() => { const cat = categories.find(c => c.id === editingId)!; const leaf = isLeaf(categories, editingId);
              const proposed = editGoal === "" ? 0 : Number(sanitizeGoalInput(editGoal));
              const sum = cat.parentId ? computeChildGoalSum(categories, cat.parentId, { id: cat.id, goal: proposed }) : computeRootGoalSum(categories, { id: cat.id, goal: proposed });
              const over = sum > 100;
              return (
                <>
                  <div className="flex items-center justify-between mb-3">
                    <div className="text-lg font-semibold">Edit {leaf ? "Subcategory" : "Category"}</div>
                  </div>
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <label className="w-24 text-sm opacity-80">Name</label>
                      <input value={editName} onChange={(e)=>setEditName(e.target.value)} className="flex-1 px-3 py-2 rounded-xl bg-[#0f1117] border border-[#2a2f45]" />
                    </div>
                    <div className="flex items-center gap-2">
                      <label className="w-24 text-sm opacity-80">Goal %</label>
                      <input type="number" inputMode="numeric" pattern="[0-9]*" min={0} max={100} value={editGoal} onChange={(e)=>setEditGoal(sanitizeGoalInput(e.target.value))} className="flex-1 px-3 py-2 rounded-xl bg-[#0f1117] border border-[#2a2f45]" />
                    </div>
                    <div className={`text-xs ${over?"text-red-400":"opacity-70"}`}>{over ? `Total ${(cat.parentId?"subcategories":"categories")} would be ${sum}%. Max is 100%. Reduce goals to save.` : `Total ${(cat.parentId?"subcategories":"categories")} after save: ${sum}% (max 100%).`}</div>
                    <div className="flex items-center gap-2">
                      <label className="w-24 text-sm opacity-80">Color</label>
                      <input type="color" value={editColor} onChange={(e)=>setEditColor(e.target.value)} className="w-12 h-9 rounded-lg border border-[#2a2f45] bg-transparent" />
                    </div>
                    <div className="flex items-center gap-2">
                      <label className="w-24 text-sm opacity-80">Icon</label>
                      <div className="flex flex-wrap gap-2">
                        {ICONS.map(ic => (
                          <button key={ic} onClick={()=>setEditIcon(ic)} className={`w-9 h-9 rounded-xl border ${editIcon===ic?"border-white":"border-[#2a2f45]"}`} title={ic}>
                            <span className="text-lg">{ic}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 mt-5">
                    <button onClick={()=>setEditingId(null)} className="px-3 py-2 rounded-xl border border-[#2a2f45] bg-[#0f1117]">Cancel</button>
                    <button onClick={saveEditor} disabled={!editName.trim() || over} className={`px-3 py-2 rounded-xl border border-[#2a2f45] ${(!editName.trim() || over)?"opacity-60 cursor-not-allowed":"bg-white text-black"}`}>Save</button>
                    {leaf && (
                      <button onClick={()=>deleteCategory(editingId)} className="ml-auto flex items-center gap-2 px-3 py-2 rounded-xl border border-[#2a2f45] text-red-300 bg-[#0f1117]">
                        <Trash2 size={16} /> Delete
                      </button>
                    )}
                  </div>
                </>
              ); })()}
          </div>
        </div>
      )}
    </div>
  );
}
