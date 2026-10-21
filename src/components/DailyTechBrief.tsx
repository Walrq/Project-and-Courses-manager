import React, { useEffect, useState } from 'react';
import { ExternalLink, Lightbulb, Newspaper, RefreshCw } from 'lucide-react';

interface HackerNewsStory {
  id: number;
  title: string;
  url?: string;
  score?: number;
  descendants?: number;
  time?: number;
  type?: string;
}

interface DailyBrief {
  date: string;
  story: HackerNewsStory;
}

const DAILY_CONCEPTS: [string, string][] = [
  ['What is a cache?', 'A cache stores a copy of data you use often, so the next request can be served faster. Browsers cache images and scripts to avoid downloading them again.'],
  ['What is an API?', 'An API is a defined way for software systems to request data or actions from one another. A weather app, for example, can ask a weather API for a forecast.'],
  ['What is open source?', 'Open source software makes its source code available under a license that lets people inspect, use, and often modify or share it.'],
  ['What is a database index?', 'A database index is an extra data structure that helps find rows quickly, much like an index in a book. It speeds up reads but takes storage and can slow down writes.'],
  ['What is HTTPS?', 'HTTPS encrypts traffic between a browser and a website and helps verify the site you connected to. It protects data in transit, but does not guarantee a site is trustworthy.'],
  ['What is version control?', 'Version control records changes to files over time. Git lets developers review earlier versions, work in branches, and combine changes.'],
  ['What is a CDN?', 'A content delivery network serves files from servers closer to visitors. This can make images, stylesheets, and other static assets load faster around the world.'],
  ['What is a service worker?', 'A service worker is a browser script that can handle network requests in the background, enabling features such as offline pages and installable web apps.'],
  ['What is a database transaction?', 'A transaction groups database operations so they succeed or fail together. This helps prevent partially saved changes when something goes wrong.'],
  ['What is latency?', 'Latency is the time it takes for data to travel from a request to its response. A fast connection can still feel slow when latency is high.'],
  ['What is encryption at rest?', 'Encryption at rest protects stored data by encoding it on disk. The data must be decrypted by an authorized system before it can be used.'],
  ['What is a load balancer?', 'A load balancer distributes incoming requests across multiple servers, helping an application handle more traffic and remain available if one server fails.'],
  ['What is a race condition?', 'A race condition happens when a result depends on the timing of concurrent operations. Careful locking, transactions, and state design can prevent it.'],
  ['What is an environment variable?', 'An environment variable is a setting provided to a program when it runs. It is often used for configuration that should differ between a developer’s computer and production.'],
];

function localDateKey(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

function conceptForToday(): [string, string] {
  const start = new Date(new Date().getFullYear(), 0, 0).getTime();
  const day = Math.floor((new Date().getTime() - start) / 86_400_000);
  return DAILY_CONCEPTS[day % DAILY_CONCEPTS.length];
}

function getSafeStoryUrl(story: HackerNewsStory): string {
  if (story.url) {
    try {
      const url = new URL(story.url);
      if (url.protocol === 'https:' || url.protocol === 'http:') return url.href;
    } catch {
      // Fall through to the Hacker News discussion page.
    }
  }
  return `https://news.ycombinator.com/item?id=${story.id}`;
}

export const DailyTechBrief: React.FC = () => {
  const [brief, setBrief] = useState<DailyBrief | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [usingFallback, setUsingFallback] = useState(false);
  const today = localDateKey();
  const [conceptTitle, conceptDescription] = conceptForToday();

  useEffect(() => {
    let cancelled = false;
    const loadBrief = async () => {
      setIsLoading(true);
      try {
        const cached = localStorage.getItem('progress_den_daily_tech_brief');
        if (cached) {
          const parsed = JSON.parse(cached) as DailyBrief;
          if (parsed.date === today && parsed.story?.title && parsed.story?.id) {
            if (!cancelled) {
              setBrief(parsed);
              setUsingFallback(false);
              setIsLoading(false);
            }
            return;
          }
        }

        const response = await fetch('https://hacker-news.firebaseio.com/v0/topstories.json');
        if (!response.ok) throw new Error('Could not load technology headlines');
        const storyIds = await response.json() as number[];
        if (!storyIds.length) throw new Error('No headlines are available');

        const dayOfYear = Math.floor((new Date(`${today}T12:00:00`).getTime() - new Date(`${today.slice(0, 4)}-01-01T00:00:00`).getTime()) / 86_400_000);
        const startIndex = dayOfYear % Math.min(storyIds.length, 20);
        let story: HackerNewsStory | null = null;
        for (let offset = 0; offset < Math.min(storyIds.length, 5); offset++) {
          const id = storyIds[(startIndex + offset) % storyIds.length];
          const itemResponse = await fetch(`https://hacker-news.firebaseio.com/v0/item/${id}.json`);
          if (!itemResponse.ok) continue;
          const item = await itemResponse.json() as HackerNewsStory | null;
          if (item?.title && item.type !== 'job') {
            story = item;
            break;
          }
        }
        if (!story) throw new Error('No headline details are available');

        const nextBrief = { date: today, story };
        localStorage.setItem('progress_den_daily_tech_brief', JSON.stringify(nextBrief));
        if (!cancelled) {
          setBrief(nextBrief);
          setUsingFallback(false);
        }
      } catch {
        if (!cancelled) {
          setBrief(null);
          setUsingFallback(true);
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    void loadBrief();
    return () => { cancelled = true; };
  }, [today]);

  const storyUrl = brief ? getSafeStoryUrl(brief.story) : '';

  return (
    <section className="linear-card p-4 sm:p-5 border-cyan-500/20 bg-gradient-to-br from-cyan-500/[0.06] via-transparent to-indigo-500/[0.04]" aria-labelledby="daily-tech-brief-title">
      <div className="flex items-start gap-3">
        <div className="w-9 h-9 rounded-lg bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center shrink-0">
          {usingFallback ? <Lightbulb className="w-4 h-4 text-cyan-400" /> : <Newspaper className="w-4 h-4 text-cyan-400" />}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-cyan-500 dark:text-cyan-400">Daily Tech Brief · {new Date(`${today}T12:00:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</p>
              <h2 id="daily-tech-brief-title" className="mt-1 text-sm font-semibold text-neutral-900 dark:text-[#f7f8f8]">
                {brief ? brief.story.title : conceptTitle}
              </h2>
            </div>
            {isLoading && <RefreshCw className="w-3.5 h-3.5 text-neutral-500 animate-spin shrink-0" aria-label="Loading headline" />}
          </div>
          <p className="mt-1.5 text-xs leading-relaxed text-neutral-600 dark:text-[#a1a6af]">
            {brief
              ? `A story from Hacker News${brief.story.score != null ? ` · ${brief.story.score} points` : ''}${brief.story.descendants != null ? ` · ${brief.story.descendants} comments` : ''}.`
              : usingFallback
                ? `${conceptDescription} Live headlines will appear when you are online.`
                : conceptDescription}
          </p>
          {brief && (
            <a href={storyUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 mt-2 text-xs font-medium text-cyan-600 dark:text-cyan-400 hover:text-cyan-500">
              Read story <ExternalLink className="w-3 h-3" />
            </a>
          )}
          {!brief && !isLoading && (
            <span className="inline-flex items-center gap-1 mt-2 text-[10px] text-neutral-500">
              <Lightbulb className="w-3 h-3" /> Concept of the day
            </span>
          )}
        </div>
      </div>
    </section>
  );
};
